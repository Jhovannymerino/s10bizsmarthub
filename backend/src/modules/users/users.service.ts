import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return users.map(this.sanitize);
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return this.sanitize(user);
  }

  async create(data: {
    email: string;
    password: string;
    username?: string;
    role?: string;
    allowedCompanies?: string[];
    allowedTabs?: string[];
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('El email ya está registrado');

    if (data.username) {
      const existingUsername = await this.prisma.user.findUnique({ where: { username: data.username } });
      if (existingUsername) throw new ConflictException('El nombre de usuario ya está en uso');
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username || null,
        passwordHash,
        role: data.role ?? 'viewer',
        allowedCompanies: data.allowedCompanies ?? [],
        allowedTabs: data.allowedTabs ?? [],
      },
    });
    return this.sanitize(user);
  }

  async update(
    id: number,
    data: {
      email?: string;
      username?: string;
      password?: string;
      role?: string;
      allowedCompanies?: string[];
      allowedTabs?: string[];
      active?: boolean;
    },
  ) {
    await this.findOne(id);

    const update: any = {};
    if (data.email !== undefined)            update.email            = data.email;
    if (data.username !== undefined)         update.username         = data.username || null;
    if (data.role !== undefined)             update.role             = data.role;
    if (data.allowedCompanies !== undefined) update.allowedCompanies = data.allowedCompanies;
    if (data.allowedTabs !== undefined)      update.allowedTabs      = data.allowedTabs;
    if (data.active !== undefined)           update.active           = data.active;
    if (data.password)                       update.passwordHash     = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.update({ where: { id }, data: update });
    return this.sanitize(user);
  }

  async deactivate(id: number) {
    await this.findOne(id);
    const user = await this.prisma.user.update({ where: { id }, data: { active: false } });
    return this.sanitize(user);
  }

  private sanitize(user: any) {
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }
}
