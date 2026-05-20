import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(
    @Body() body: {
      email: string;
      password: string;
      username?: string;
      role?: string;
      allowedCompanies?: string[];
      allowedTabs?: string[];
    },
  ) {
    return this.usersService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: {
      email?: string;
      username?: string;
      password?: string;
      role?: string;
      allowedCompanies?: string[];
      allowedTabs?: string[];
      active?: boolean;
    },
  ) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deactivate(id);
  }
}
