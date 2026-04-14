import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UsersModule } from '../users/users.module';
import { SchoolsModule } from '../schools/schools.module';
import { FirebaseStrategy } from './strategies/firebase.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TeacherInviteModule } from '../teacher-invite/teacher-invite.module';
import { MailModule } from '../mail/mail.module';
import { AuthOtpModule } from './auth-otp.module';

@Module({
  imports: [
    AuthOtpModule,
    PassportModule.register({ defaultStrategy: 'firebase' }),
    TypeOrmModule.forFeature([User, PasswordResetToken]),
    UsersModule,
    SchoolsModule,
    TeacherInviteModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [FirebaseStrategy, AuthService],
  exports: [AuthService],
})
export class AuthModule {}
