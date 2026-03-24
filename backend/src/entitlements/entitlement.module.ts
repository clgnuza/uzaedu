import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entitlement } from './entities/entitlement.entity';
import { EntitlementService } from './entitlement.service';
import { EntitlementsController } from './entitlements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Entitlement])],
  controllers: [EntitlementsController],
  providers: [EntitlementService],
  exports: [EntitlementService],
})
export class EntitlementModule {}
