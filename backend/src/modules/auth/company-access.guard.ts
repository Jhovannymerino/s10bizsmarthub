import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const companyId: string | undefined = req.params?.companyId;

    if (!companyId) return true;
    if (user?.role === 'admin') return true;

    const allowed: string[] = Array.isArray(user?.allowedCompanies) ? user.allowedCompanies : [];
    if (allowed.length > 0 && !allowed.includes(companyId)) {
      throw new ForbiddenException('No tiene acceso a esta empresa');
    }

    return true;
  }
}
