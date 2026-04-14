import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthVerificationCode } from './entities/auth-verification-code.entity';
import { AuthOtpService } from './auth-otp.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuthVerificationCode])],
  providers: [AuthOtpService],
  exports: [AuthOtpService, TypeOrmModule],
})
export class AuthOtpModule {}
