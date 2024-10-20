import OpenAI from 'openai';
import { Project } from './entity/Project';
import fs from 'fs/promises';
const pathModule = require('path');

// const PROJ_PATH = '/home/isaqueks/Tiny-converter2';

const backlog = (content: string) => {
  return fs.appendFile('backlog.txt', String(content) + '\n');
}

const funcs = (PROJ_PATH: string) => ({
  shell_exec: async ({ command, working_directory }) => {
    working_directory = pathModule.join(PROJ_PATH, working_directory); // Resolve the path to the project directory

    try {
      const { exec } = require('child_process');
      return new Promise((resolve, reject) => {
        exec(command, { cwd: working_directory }, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout);
          }
        });
      });
    } catch (err) {
      console.error('Error executing shell command:', err);
      throw err;
    }
  },
  list_files: async ({ path, recursive_depth }) => {

    path = pathModule.join(PROJ_PATH, path); // Resolve the path to the project directory

    try {
      const results: string[] = [];

      async function walkDir(currentPath, currentDepth) {
        if (currentPath.includes('node_modules') || currentPath.includes('.git') || currentPath.includes('dist') || currentPath.includes('build')) return; // Skip node_modules

        if (currentDepth > recursive_depth) return; // Stop if the depth limit is reached
        const dirEntries = await fs.readdir(currentPath, { withFileTypes: true });

        for (let entry of dirEntries) {
          const fullPath = pathModule.join(currentPath, entry.name);
          results.push(fullPath.replace(PROJ_PATH, ''));

          if (entry.isDirectory()) {
            await walkDir(fullPath, currentDepth + 1); // Recurse into subdirectories
          }
        }
      }

      await walkDir(path, 1);
      return results;
    } catch (err) {
      console.error('Error listing files:', err);
      throw err;
    }
  },
  read_file: async ({ file_path }) => {
    try {
      file_path = pathModule.join(PROJ_PATH, file_path); // Resolve the path to the project directory
      const data = await fs.readFile(file_path, 'utf-8'); // Read file content as a string
      return data;
    } catch (err) {
      console.error('Error reading file:', err);
      throw err;
    }
  },
  write_file: async ({ file_path, content }) => {
    try {
      file_path = pathModule.join(PROJ_PATH, file_path); // Resolve the path to the project directory
      await fs.writeFile(file_path, content, 'utf-8'); // Write content to file as a string
      return 'File written successfully!';
    } catch (err) {
      console.error('Error writing file:', err);
      throw err;
    }
  }
});

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

  private proj: Project;

  public setProject(proj: Project) {
    this.proj = proj;
  }

  private async getThreadID(): Promise<string> {
    // get existing or create
    if (!this.proj.threadId) {

      const newThread = await this.openAI.beta.threads.create();
      this.proj.threadId = newThread.id;

      this.proj = await Project.repo.save(this.proj);
    }
    return this.proj.threadId;
  }

  public async ask(user: string, system?: string): Promise<string> {
    // create a temp thread   
    
    const thId = await this.getThreadID();
    
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
    );

    while (run.status !== 'completed') {
      if (run.status === 'failed') {
        console.error(run.last_error);
        throw new Error('Run failed');
      }
      if (run.status === 'requires_action') {
        const outs: any[] = [];
        // console.log(run.required_action!.submit_tool_outputs.tool_calls)
        for (const tool of run.required_action!.submit_tool_outputs.tool_calls) {
          const fn = funcs(this.proj.path)[tool.function.name];
          if (!fn) {
            throw new Error(`Unknown tool: ${tool.function.name}`);
          }

          const args = JSON.parse(tool.function.arguments);
          backlog(`${fn.name}(${JSON.stringify(args)})`);

          let output;
          
          try {
            output = await fn(args);
          }
          catch (err) {
            output = { error: err.message || String(err) };
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
      run = await this.openAI.beta.threads.runs.retrieve(thId, run.id);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const messages = await this.openAI.beta.threads.messages.list(thId);
    const lastMessage = messages.data[0].content[0] as OpenAI.Beta.Threads.Messages.TextContentBlock;


    return lastMessage.text.value;
  }
}