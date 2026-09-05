export class History<T> {
  private undoStack: T[] = [];
  private redoStack: T[] = [];

  constructor(private readonly limit = 40) {}

  push(value: T): void {
    this.undoStack.push(value);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(current: T): T | null {
    const previous = this.undoStack.pop();
    if (previous == null) return null;
    this.redoStack.push(current);
    return previous;
  }

  redo(current: T): T | null {
    const next = this.redoStack.pop();
    if (next == null) return null;
    this.undoStack.push(current);
    return next;
  }
}
