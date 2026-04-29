import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.company.findMany({ where: { active: true } });
  }

  findOne(codEmpresa: string) {
    return this.prisma.company.findUnique({ where: { codEmpresa } });
  }

  create(data: { codEmpresa: string; name: string; claseIngreso?: string }) {
    return this.prisma.company.create({ data });
  }

  update(codEmpresa: string, data: Partial<{ name: string; claseIngreso: string; active: boolean }>) {
    return this.prisma.company.update({ where: { codEmpresa }, data });
  }
}
