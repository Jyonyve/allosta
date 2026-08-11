import {
  Body,
  Controller,
  Injectable,
  Module,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../common/auth.js';

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}

@Injectable()
class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}
  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user || !(await compare(input.password, user.passwordHash)))
      throw new UnauthorizedException('Invalid email or password');
    return {
      accessToken: await this.jwt.signAsync({
        id: user.id,
        email: user.email,
        role: user.role,
      }),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}

@Controller('auth')
class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('login') login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'development-only-change-me',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
