import AppDataSource from "./ormconfig";
import { GPTService } from "./src/services/GPTService";
import { SessionManager } from "./src/services/SessionManager";
import { Project } from "./src/entity/Project";
import { FunctionHandler } from "./src/handlers/FunctionHandler";
import marked from 'marked';
import TerminalRenderer from 'marked-terminal';

const OPENAI_KEY = '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';
const ASSISTANT_ID = 'asst_epuNl4Z2x9hl225KUc4mk9ll';

const sessionManager = new SessionManager();

function prompt(text: string): Promise<string> {
  process.stdout.write(text);
  return new Promise(resolve => {
    process.stdin.once('data', data => {
      resolve(data.toString().trim());
    });
  });
}

marked.setOptions({
  renderer: new TerminalRenderer()
});

(async () => {
  await AppDataSource.initialize();

  let proj: Project;
  while (!proj) {
    const name = await prompt('Project name: ');
    proj = await Project.repo.findOne({ where: { name } });
    if (!proj) {
      console.log('Project not found, creating!');

      const path = await prompt('Project path: ');

      proj = new Project();
      proj.name = name;
      proj.path = path;
      proj = await Project.repo.save(proj);
    }
  }

  sessionManager.setThreadId(proj.threadId);

    // Define um dicionário de funções
  const functionHandler = new FunctionHandler(proj.path); // Utilize o caminho apropriado
  const functionsDictionary = {
    shell_exec: functionHandler.shell_exec.bind(functionHandler),
    list_files: functionHandler.list_files.bind(functionHandler),
    read_file: functionHandler.read_file.bind(functionHandler),
    write_file: functionHandler.write_file.bind(functionHandler),
  };

  const gpt = new GPTService(OPENAI_KEY, ASSISTANT_ID, functionsDictionary);

  while(true) {
    const user = await prompt('You: ');
    if (!user) {
      break;
    }
    const response = await gpt.ask(user, sessionManager);
    console.log(marked.parse(response));

    const newThreadId = sessionManager.getThreadId();
    if (newThreadId !== proj.threadId) {
      proj.threadId = newThreadId;
      await Project.repo.save(proj);
    }
  }

})().catch(console.error);