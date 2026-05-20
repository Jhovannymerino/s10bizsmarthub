import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 15;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  private async findByLogin(login: string) {
    const normalized = login.trim().toLowerCase();
    const isEmail = normalized.includes('@');
    return this.prisma.user.findFirst({
      where: isEmail
        ? { email: { equals: normalized, mode: 'insensitive' } }
        : { username: { equals: normalized, mode: 'insensitive' } },
    });
  }

  async validateUser(login: string, password: string) {
    const user = await this.findByLogin(login);
    if (!user || !user.active) throw new UnauthorizedException('Invalid credentials');

    let valid = false;
    let needsRehash = false;

    if (user.passwordHash.startsWith('$2')) {
      valid = await bcrypt.compare(password, user.passwordHash);
    } else {
      const sha256 = crypto.createHash('sha256').update(password).digest('hex');
      valid = sha256 === user.passwordHash;
      needsRehash = valid;
    }

    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const updates: any = { lastLoginAt: new Date() };
    if (needsRehash) updates.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await this.prisma.user.update({ where: { id: user.id }, data: updates });
    return user;
  }

  async login(login: string, password: string) {
    const user = await this.validateUser(login, password);
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      allowedCompanies: user.allowedCompanies,
      allowedTabs: (user as any).allowedTabs ?? [],
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        email: user.email,
        username: (user as any).username ?? null,
        role: user.role,
        allowedCompanies: user.allowedCompanies,
        allowedTabs: (user as any).allowedTabs ?? [],
      },
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async updateProfile(userId: number, data: { email?: string; username?: string }): Promise<void> {
    const update: any = {};
    if (data.email) {
      const email = data.email.trim().toLowerCase();
      const existing = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, id: { not: userId } } });
      if (existing) throw new BadRequestException('Ese correo ya está en uso por otro usuario');
      update.email = email;
    }
    if (data.username !== undefined) {
      const username = data.username.trim().toLowerCase() || null;
      if (username) {
        const existing = await this.prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' }, id: { not: userId } } });
        if (existing) throw new BadRequestException('Ese usuario ya está en uso');
      }
      update.username = username;
    }
    if (Object.keys(update).length > 0) {
      await this.prisma.user.update({ where: { id: userId }, data: update });
    }
  }

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) throw new UnauthorizedException('Usuario no encontrado');
    const { passwordHash: _ph, ...safe } = user as any;
    return safe;
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) throw new UnauthorizedException('Usuario no encontrado');

    let valid = false;
    if (user.passwordHash.startsWith('$2')) {
      valid = await bcrypt.compare(currentPassword, user.passwordHash);
    } else {
      const sha256 = crypto.createHash('sha256').update(currentPassword).digest('hex');
      valid = sha256 === user.passwordHash;
    }

    if (!valid) throw new BadRequestException('La contraseña actual es incorrecta');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async requestPasswordRecovery(login: string): Promise<void> {
    const user = await this.findByLogin(login);
    if (!user || !user.active) return;

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const tokenHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    await this.mailService.sendRecoveryCode(user.email, otp).catch(err => {
      this.logger.error(`Recovery email failed for ${user.email}`, err);
    });
  }

  async verifyOtp(login: string, otp: string): Promise<void> {
    const user = await this.findByLogin(login);
    if (!user) throw new BadRequestException('Código inválido o expirado');

    const token = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!token || token.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Código inválido o expirado');
    }

    const valid = await bcrypt.compare(otp, token.tokenHash);
    if (!valid) {
      await this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Código incorrecto');
    }
  }

  async resetPassword(login: string, otp: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    }

    const user = await this.findByLogin(login);
    if (!user) throw new BadRequestException('Código inválido o expirado');

    const token = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!token || token.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Código inválido o expirado');
    }

    const valid = await bcrypt.compare(otp, token.tokenHash);
    if (!valid) {
      await this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Código incorrecto');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    ]);
  }
}
