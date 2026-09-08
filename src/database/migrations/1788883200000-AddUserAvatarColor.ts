import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAvatarColor1788883200000 implements MigrationInterface {
  name = 'AddUserAvatarColor1788883200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "avatar_color" varchar(7) NOT NULL DEFAULT '#0B6E4F'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatar_color"`);
  }
}
