import { Controller, Post, Get, Patch, Body, HttpCode, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() body: { login: string; password: string }) {
    return this.authService.login(body.login, body.password);
  }

  @Post('recovery/request')
  @HttpCode(200)
  async requestRecovery(@Body() body: { login: string }) {
    await this.authService.requestPasswordRecovery(body.login);
    return { message: 'Si el correo está registrado, recibirás un código de verificación.' };
  }

  @Post('recovery/verify')
  @HttpCode(200)
  async verifyOtp(@Body() body: { login: string; otp: string }) {
    await this.authService.verifyOtp(body.login, body.otp);
    return { valid: true };
  }

  @Post('recovery/reset')
  @HttpCode(200)
  async resetPassword(@Body() body: { login: string; otp: string; newPassword: string }) {
    await this.authService.resetPassword(body.login, body.otp, body.newPassword);
    return { message: 'Contraseña actualizada correctamente.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: any) {
    return this.authService.getMe(req.user.userId);
  }

  @Patch('profile')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req: any, @Body() body: { email?: string; username?: string }) {
    await this.authService.updateProfile(req.user.userId, body);
    return { message: 'Perfil actualizado correctamente.' };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async changePassword(@Request() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    await this.authService.changePassword(req.user.userId, body.currentPassword, body.newPassword);
    return { message: 'Contraseña actualizada correctamente.' };
  }
}
