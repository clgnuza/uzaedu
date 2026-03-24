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
import { EmailService } from './services/email.service';
import { TeacherInviteModule } from '../teacher-invite/teacher-invite.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'firebase' }),
    TypeOrmModule.forFeature([User, PasswordResetToken]),
    UsersModule,
    SchoolsModule,
    TeacherInviteModule,
  ],
  controllers: [AuthController],
  providers: [FirebaseStrategy, AuthService, EmailService],
  exports: [AuthService],
})
export class AuthModule {}
