import React from 'react'
import { Text as RNText, type TextProps, type TextStyle } from 'react-native'
import { colors, fonts, fontSize } from '@/src/ui/theme'

type Variant =
  | 'hero'         // 56pt serif — SR number, big PnL
  | 'display'      // 28pt serif — screen titles
  | 'title'        // 17pt Inter SemiBold — card titles
  | 'body'         // 15pt Inter — body copy
  | 'label'        // 13pt Inter Medium — labels
  | 'caption'      // 11pt Inter — captions, eyebrows
  | 'numeric'      // 17pt SpaceGrotesk — tabular numbers
  | 'numericLarge' // 42pt SpaceGrotesk Bold — large metrics

const VARIANT_STYLE: Record<Variant, TextStyle> = {
  hero: {
    fontFamily: fonts.serif,
    fontSize: fontSize.hero,    // 56
    lineHeight: 60,
    letterSpacing: -0.5,
    color: colors.text,
  },
  display: {
    fontFamily: fonts.serif,
    fontSize: fontSize.xxl,     // 28
    lineHeight: 34,
    letterSpacing: -0.3,
    color: colors.text,
  },
  title: {
    fontFamily: fonts.uiSemiBold,
    fontSize: fontSize.lg,      // 17
    lineHeight: 24,
    letterSpacing: -0.2,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: fontSize.md,      // 15
    lineHeight: 22,
    letterSpacing: 0.1,
    color: colors.text,
  },
  label: {
    fontFamily: fonts.uiMedium,
    fontSize: fontSize.sm,      // 13
    lineHeight: 18,
    letterSpacing: 0.1,
    color: colors.textSub,
  },
  caption: {
    fontFamily: fonts.ui,
    fontSize: fontSize.xs,      // 11
    lineHeight: 15,
    letterSpacing: 0.3,
    color: colors.muted,
  },
  numeric: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,      // 17
    lineHeight: 24,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  numericLarge: {
    fontFamily: fonts.serifBold,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -0.5,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
}

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <RNText style={[VARIANT_STYLE[variant], style]} {...rest} />
}
