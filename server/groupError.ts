export class GroupError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
