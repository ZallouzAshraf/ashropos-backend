import { Role } from '../../../common/enums/role.enum';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  organizationId: string;
  role: Role;
  membershipId: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
  type: 'refresh';
}
