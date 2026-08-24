import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SellerAuthGuard } from './seller-auth.guard';
import type { RequestWithStore } from './request-with-store.interface';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SellerAuthGuard)
  deleteAccount(@Req() req: RequestWithStore) {
    return this.authService.deleteAccount(req.store.id);
  }
}
