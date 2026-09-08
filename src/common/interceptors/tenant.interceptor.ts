import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from '../context/tenant-context';
import { AuthUser } from '../types/auth-user';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      return next.handle();
    }
    return new Observable((subscriber) => {
      TenantContext.run(user, () => {
        const subscription = next.handle().subscribe(subscriber);
        return () => subscription.unsubscribe();
      });
    });
  }
}
