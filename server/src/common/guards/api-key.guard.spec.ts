import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { AuthService } from '../../auth/auth.service';
import type { Partner } from '@prisma/client';

function makeContext(headers: Record<string, string> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers, partner: undefined as Partner | undefined }),
    }),
  } as unknown as ExecutionContext;
}

const mockPartner: Partner = {
  id: 'partner-1',
  name: 'demo',
  keyPrefix: 'aabbccdd',
  apiKeyHash: '$2b$10$hashhash',
  webhookSecret: 'secret',
  createdAt: new Date(),
};

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let authService: jest.Mocked<Pick<AuthService, 'validateApiKey'>>;

  beforeEach(() => {
    authService = { validateApiKey: jest.fn() };
    guard = new ApiKeyGuard(authService as unknown as AuthService);
  });

  it('throws 401 with MISSING_API_KEY when header is absent', async () => {
    const ctx = makeContext({});

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);

    try {
      await guard.canActivate(makeContext({}));
    } catch (err) {
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: 'MISSING_API_KEY',
      });
    }

    expect(authService.validateApiKey).not.toHaveBeenCalled();
  });

  it('throws 401 with INVALID_API_KEY when key fails validation', async () => {
    authService.validateApiKey.mockResolvedValue(null);
    const ctx = makeContext({ 'x-api-key': 'sk_bad_key' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);

    try {
      await guard.canActivate(makeContext({ 'x-api-key': 'sk_bad_key' }));
    } catch (err) {
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: 'INVALID_API_KEY',
      });
    }
  });

  it('attaches partner to request and returns true on valid key', async () => {
    authService.validateApiKey.mockResolvedValue(mockPartner);
    const req = { headers: { 'x-api-key': 'sk_aabbccddvalidkey' }, partner: undefined };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.partner).toEqual(mockPartner);
    expect(authService.validateApiKey).toHaveBeenCalledWith('sk_aabbccddvalidkey');
  });

  it('does not call validateApiKey when header is an empty string', async () => {
    const ctx = makeContext({ 'x-api-key': '' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(authService.validateApiKey).not.toHaveBeenCalled();
  });
});
