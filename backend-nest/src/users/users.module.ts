import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { GuardsModule } from '../auth/guards.module';

@Module({
  imports: [GuardsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
