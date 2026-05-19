import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) throw new UnauthorizedException('Invalid credentials');

    let valid = false;
    let needsRehash = false;

    if (user.passwordHash.startsWith('$2')) {
      // bcrypt hash
      valid = await bcrypt.compare(password, user.passwordHash);
    } else {
      // legacy SHA256 — migrate on successful login
      const sha256 = crypto.createHash('sha256').update(password).digest('hex');
      valid = sha256 === user.passwordHash;
      needsRehash = valid;
    }

    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const updates: any = { lastLoginAt: new Date() };
    if (needsRehash) {
      updates.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    await this.prisma.user.update({ where: { id: user.id }, data: updates });

    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      allowedCompanies: user.allowedCompanies,
      allowedTabs: (user as any).allowedTabs ?? [],
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: { email: user.email, role: user.role, allowedCompanies: user.allowedCompanies, allowedTabs: (user as any).allowedTabs ?? [] },
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }
}
