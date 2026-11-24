/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import * as React from 'react'

import { Input } from './input'

type DecimalInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'defaultValue' | 'onChange' | 'type'
> & {
  /** Current numeric value. `undefined` renders an empty box. */
  value: number | undefined
  /** Called with the parsed number whenever the text is a complete, valid number. */
  onValueChange: (value: number | undefined) => void
  /** Allow negative numbers. Defaults to false. */
  allowNegative?: boolean
}

const PARTIAL_DECIMAL = /^-?\d*\.?\d*$/

function toText(value: number | undefined) {
  return value === undefined || Number.isNaN(value) ? '' : String(value)
}

/**
 * Text box for decimal numbers that keeps what the user is typing.
 *
 * A plain controlled `<Input value={String(n)} />` re-renders from the parsed
 * number on every keystroke, so intermediate text such as `0.` or `1.0`
 * collapses back to `0` / `1` and the decimal point can never be typed. This
 * component keeps the raw text locally and only reports a number upward once
 * the text parses; an empty box reports `undefined`.
 */
export function DecimalInput({
  value,
  onValueChange,
  allowNegative = false,
  onBlur,
  ...props
}: DecimalInputProps) {
  const [text, setText] = React.useState(() => toText(value))

  // Follow external changes (switching models, resets) without clobbering a
  // draft such as `0.` that already represents the same number.
  React.useEffect(() => {
    setText((current) => {
      const currentNumber = current.trim() === '' ? undefined : Number(current)
      if (currentNumber === value) return current
      // Parents that store an empty box as 0 should not force a `0` back in
      // while the user is retyping the value.
      if (current.trim() === '' && value === 0) return current
      return toText(value)
    })
  }, [value])

  return (
    <Input
      placeholder='0'
      {...props}
      type='text'
      inputMode='decimal'
      autoComplete='off'
      value={text}
      onChange={(event) => {
        const next = event.target.value.replace(/,/g, '.').replace(/\s/g, '')
        if (!PARTIAL_DECIMAL.test(next)) return
        if (!allowNegative && next.startsWith('-')) return
        setText(next)
        if (next === '') {
          onValueChange(undefined)
          return
        }
        const parsed = Number(next)
        if (Number.isFinite(parsed) && next !== '-' && next !== '.') {
          onValueChange(parsed)
        }
      }}
      onBlur={(event) => {
        // Tidy trailing dots like `3.` -> `3` once the user leaves the box.
        if (text !== '' && Number.isFinite(Number(text))) {
          setText(toText(Number(text)))
        }
        onBlur?.(event)
      }}
    />
  )
}
