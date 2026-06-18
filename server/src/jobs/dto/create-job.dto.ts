import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  caseType: string;

  @IsUrl({}, { message: 'callbackUrl must be a valid URL' })
  callbackUrl: string;
}
