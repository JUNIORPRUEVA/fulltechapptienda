import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'
import { normalizeJwtSecret } from '../jwt.util'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: normalizeJwtSecret(config.get<string>('JWT_SECRET')) || 'dev_secret',
    })
  }

  async validate(payload: { sub: string; role: string; tokenType?: 'access' | 'refresh' }) {
    if (payload.tokenType === 'refresh') {
      throw new UnauthorizedException('Invalid token')
    }
    const user = await this.findUserForJwt(payload.sub)

    if (!user) throw new UnauthorizedException('No autorizado')

    return { sub: user.id, role: user.role }
  }

  private isMissingUserTable(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2021'
    }

    if (typeof error === 'object' && error !== null) {
      const value = error as { code?: unknown; message?: unknown }
      const code = typeof value.code === 'string' ? value.code : ''
      const message = typeof value.message === 'string' ? value.message : ''
      return code === 'P2021' || message.includes('does not exist in the current database')
    }

    return false
  }

  private async findUserForJwt(userId: string) {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      })
    } catch (error) {
      if (!this.isMissingUserTable(error)) throw error

      const rows = await this.prisma.$queryRaw<Array<{ id: string; role: string }>>(Prisma.sql`
        SELECT id, role
        FROM users
        WHERE id = ${userId}
        LIMIT 1
      `)

      const row = rows[0]
      if (!row) return null
      return { id: row.id, role: row.role }
    }
  }
}
