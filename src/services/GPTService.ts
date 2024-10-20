import OpenAI from 'openai';
import { FunctionHandler } from '../handlers/FunctionHandler';
import { SessionManager } from './SessionManager';
import fs from 'fs/promises';
import { TextContentBlock } from 'openai/resources/beta/threads/messages';

const backlog = (content: string): Promise<void> => {
  return fs.appendFile('backlog.txt', String(content) + '\n');
}

interface ToolCall {
  function: {
    name: string;
    arguments: string;
  };
  id: string;
}

interface Run {
  status: string;
  required_action?: {
    submit_tool_outputs: {
      tool_calls: ToolCall[];
    };
  };
  last_error?: string;
  id: string;
}

interface MessageBlock {
  role: string;
  content: string[];
}

export class GPTService {

  private readonly openAI: OpenAI;

  constructor(
    private readonly openAIToken: string,
    private readonly assistantID: string,
  ) {
    this.openAI = new OpenAI({
      apiKey: openAIToken,
    });
  }

  private async getThreadID(sessionManager: SessionManager): Promise<string> {
    const existingThreadId = sessionManager.getThreadId();
    if (existingThreadId) {
      return existingThreadId;
    }

    const newThread = await this.openAI.beta.threads.create();
    sessionManager.setThreadId(newThread.id);
    return newThread.id;
  }

  private async handleRequiresAction(run: Run, thId: string, fh: FunctionHandler): Promise<void> {
    const outs: { tool_call_id: string; output: string; }[] = [];

    for (const tool of run.required_action!.submit_tool_outputs.tool_calls) {
      const fn = fh[tool.function.name].bind(fh) as (args: any) => Promise<any>;
      if (!fn) {
        throw new Error(`Unknown tool: ${tool.function.name}`);
      }

      const args = JSON.parse(tool.function.arguments);
      backlog(`${fn.name}(${JSON.stringify(args)})`);

      let output: any;
      try {
        output = await fn(args);
      } catch (err) {
        output = { error: (err as Error).message || String(err) };
      }

      backlog(JSON.stringify(output, null, 2));

      outs.push({
        tool_call_id: tool.id,
        output: JSON.stringify(output)
      });
    }

    await this.openAI.beta.threads.runs.submitToolOutputs(
      thId,
      run.id,
      { tool_outputs: outs },
    );
  }

  private async performRunCycle(thId: string, run: Run, fh: FunctionHandler): Promise<void> {
    while (run.status !== 'completed') {
      if (run.status === 'failed') {
        console.error(run.last_error);
        throw new Error('Run failed');
      }
      if (run.status === 'requires_action') {
        await this.handleRequiresAction(run, thId, fh);
      }
      run = await this.openAI.beta.threads.runs.retrieve(thId, run.id) as unknown as Run;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  public async ask(user: string, sessionManager: SessionManager): Promise<string> {
    const thId = await this.getThreadID(sessionManager);
    const message = await this.openAI.beta.threads.messages.create(
      thId,
      {
        role: 'user',
        content: user,
      }
    );

    let run = await this.openAI.beta.threads.runs.create(
      thId,
      {
        assistant_id: this.assistantID,
      }
    ) as unknown as Run;

    const fh = new FunctionHandler('./'); // Provide the appropriate path
    await this.performRunCycle(thId, run, fh);

    const messages = await this.openAI.beta.threads.messages.list(thId);
    const lastMessage = messages.data[0].content[0] as TextContentBlock;

    return lastMessage.text.value;
  }
}
