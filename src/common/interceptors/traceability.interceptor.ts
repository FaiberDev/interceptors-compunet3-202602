import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import { AppLogger } from '../logger/logger.service';

@Injectable()
export class TraceabilityInterceptor implements NestInterceptor {
    constructor(private readonly logger: AppLogger) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<Request>();
        const response = ctx.getResponse<Response>();

        // 1. Captura o Generación de ID
        const incomingId = request.headers['x-correlation-id'];
        const correlationId = typeof incomingId === 'string' ? incomingId : crypto.randomUUID();

        // 2. Inyección en el Contexto
        (request as any).correlationId = correlationId;
        response.setHeader('x-correlation-id', correlationId);

        const now = Date.now();
        const method = request.method;
        const url = request.originalUrl;

        // 3. Medición de Latencia y Logging de Salida
        return next.handle().pipe(
            finalize(() => {
                const duration = Date.now() - now;
                const statusCode = response.statusCode;

                // 4. Registra un log informativo
                const message = `[${method} ${url}] [${statusCode} OK] [Duration: ${duration}ms]`;
                this.logger.logWithTrace(correlationId, 'TRACE', message);
            }),
        );
    }
}
