import { Module } from '@nestjs/common';
import { S10Service } from './s10.service';

@Module({
  providers: [S10Service],
  exports: [S10Service],
})
export class S10Module {}
