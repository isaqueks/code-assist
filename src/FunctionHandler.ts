import fs from 'fs/promises';
import { FileUtils } from './utility/FileUtils';
const pathModule = require('path');

export class FunctionHandler {
  constructor(private readonly PROJ_PATH: string) {}

  async shell_exec({ command, working_directory }: { command: string; working_directory: string }): Promise<string> {
    working_directory = pathModule.join(this.PROJ_PATH, working_directory);

    try {
      const { exec } = require('child_process');
      return new Promise((resolve, reject) => {
        exec(command, { cwd: working_directory }, (error, stdout, stderr) => {
          if (error) {
            reject(error + '\n' + stderr);
          } else {
            resolve(stdout);
          }
        });
      });
    } catch (err) {
      console.error('Error executing shell command:', err);
      throw err;
    }
  }

  async list_files({ path, recursive_depth }: { path: string; recursive_depth: number }): Promise<string[]> {
    path = pathModule.join(this.PROJ_PATH, path);
    const ignoredPaths = await FileUtils.getIgnoredPaths(this.PROJ_PATH);

    try {
      const results: string[] = [];
      await FileUtils.walkDir(path, 1, recursive_depth, ignoredPaths, results, this.PROJ_PATH);
      return results;
    } catch (err) {
      console.error('Error listing files:', err);
      throw err;
    }
  }

  async read_file({ file_path }: { file_path: string }): Promise<string> {
    try {
      file_path = pathModule.join(this.PROJ_PATH, file_path);
      const data = await fs.readFile(file_path, 'utf-8');
      return data;
    } catch (err) {
      console.error('Error reading file:', err);
      throw err;
    }
  }

  async write_file({ file_path, content }: { file_path: string; content: string }): Promise<string> {
    try {
      file_path = pathModule.join(this.PROJ_PATH, file_path);
      await fs.writeFile(file_path, content, 'utf-8');
      return 'File written successfully!';
    } catch (err) {
      console.error('Error writing to file:', err);
      throw err;
    }
  }
}
