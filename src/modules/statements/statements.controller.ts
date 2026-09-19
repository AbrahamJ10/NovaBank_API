import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as statementsService from "./statements.service";
import { sendStatementSchema } from "./statements.validators";

export async function sendStatementHandler(req: AuthenticatedRequest, res: Response) {
  const input = sendStatementSchema.parse(req.body);
  await statementsService.sendStatement(req.user!.id, input);
  res.status(204).send();
}
