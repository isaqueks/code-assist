import fs from 'fs/promises';
const pathModule = require('path');

export class FileUtils {

  static async getIgnoredPaths(PROJ_PATH: string): Promise<string[]> {
    try {
      const data = await fs.readFile(pathModule.join(PROJ_PATH, '.gitignore'), 'utf-8');
      return data.split('\n').map(path => path.trim()).filter(path => path && !path.startsWith('#'));
    } catch {
      return ['node_modules', '.git', 'dist', 'build'];
    }
  }

  static async walkDir(currentPath: string, currentDepth: number, recursive_depth: number, ignoredPaths: string[], results: string[], PROJ_PATH: string): Promise<void> {
    if (ignoredPaths.some(ignored => currentPath.includes(ignored))) return;

    if (currentDepth > recursive_depth) return;
    const dirEntries = await fs.readdir(currentPath, { withFileTypes: true });

    for (let entry of dirEntries) {
      const fullPath = pathModule.join(currentPath, entry.name);
      results.push(fullPath.replace(PROJ_PATH, ''));

      if (entry.isDirectory()) {
        await this.walkDir(fullPath, currentDepth + 1, recursive_depth, ignoredPaths, results, PROJ_PATH);
      }
    }
  }

}