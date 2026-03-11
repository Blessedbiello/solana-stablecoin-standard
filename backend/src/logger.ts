import pino, { Logger } from "pino";
import config from "./config.js";

const transport =
  config.logPretty
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined;

export const logger: Logger = pino(
  {
    level: config.logLevel,
    base: { service: "sss-backend", mode: config.mode },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  },
  transport ? pino.transport(transport) : undefined
);

export default logger;
