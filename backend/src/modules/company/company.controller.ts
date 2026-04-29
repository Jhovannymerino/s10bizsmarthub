import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { CompanyService } from './company.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private companyService: CompanyService) {}

  @Get()
  findAll() {
    return this.companyService.findAll();
  }

  @Get(':codEmpresa')
  findOne(@Param('codEmpresa') codEmpresa: string) {
    return this.companyService.findOne(codEmpresa);
  }

  @Post()
  create(@Body() body: { codEmpresa: string; name: string; claseIngreso?: string }) {
    return this.companyService.create(body);
  }

  @Patch(':codEmpresa')
  update(
    @Param('codEmpresa') codEmpresa: string,
    @Body() body: Partial<{ name: string; claseIngreso: string; active: boolean }>,
  ) {
    return this.companyService.update(codEmpresa, body);
  }
}
