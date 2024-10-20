export class SessionManager {
  private threadId: string | null = null;

  public getThreadId(): string | null {
    return this.threadId;
  }

  public setThreadId(threadId: string): void {
    this.threadId = threadId;
  }
}
