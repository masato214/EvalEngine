import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class LoginDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(6) password!: string;
  @ApiProperty() @IsString() tenantId!: string;
}

class RefreshDto {
  @ApiProperty() @IsString() refreshToken!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'ログイン', description: 'メールアドレス・パスワード・テナントIDでログインし、JWTアクセストークンとリフレッシュトークンを取得します。' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password, dto.tenantId);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'トークンリフレッシュ', description: 'リフレッシュトークンを使って新しいアクセストークンを発行します。アクセストークンの有効期限は15分です。' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'ログアウト', description: 'リフレッシュトークンを無効化してログアウトします。' })
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.id);
  }
}
