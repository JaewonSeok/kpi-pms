import assert from 'node:assert/strict'
import React from 'react'
import { linkifyText } from '../src/lib/linkify'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  await run('plain text with no URL returns a single string segment', () => {
    const result = linkifyText('hello world')
    assert.equal(result.length, 1)
    assert.equal(result[0], 'hello world')
  })

  await run('https:// URL only produces one <a> element with correct props', () => {
    const result = linkifyText('https://example.com')
    assert.equal(result.length, 1)
    assert.equal(React.isValidElement(result[0]), true)
    const el = result[0] as React.ReactElement<Record<string, unknown>>
    assert.equal(el.props.href, 'https://example.com')
    assert.equal(el.props.target, '_blank')
    assert.equal(el.props.rel, 'noopener noreferrer')
  })

  await run('http:// (non-https) URL is also linked', () => {
    const result = linkifyText('http://example.com')
    assert.equal(result.length, 1)
    assert.equal(React.isValidElement(result[0]), true)
    const el = result[0] as React.ReactElement<Record<string, unknown>>
    assert.equal(el.props.href, 'http://example.com')
  })

  await run('text before and after URL splits into 3 segments', () => {
    const result = linkifyText('visit https://example.com now')
    assert.equal(result.length, 3)
    assert.equal(result[0], 'visit ')
    assert.equal(React.isValidElement(result[1]), true)
    assert.equal(result[2], ' now')
  })

  await run('multiple URLs produce correct segment count and order', () => {
    const result = linkifyText('a https://foo.com b https://bar.com c')
    assert.equal(result.length, 5)
    assert.equal(result[0], 'a ')
    assert.equal(React.isValidElement(result[1]), true)
    assert.equal(result[2], ' b ')
    assert.equal(React.isValidElement(result[3]), true)
    assert.equal(result[4], ' c')
    const el1 = result[1] as React.ReactElement<Record<string, unknown>>
    const el3 = result[3] as React.ReactElement<Record<string, unknown>>
    assert.equal(el1.props.href, 'https://foo.com')
    assert.equal(el3.props.href, 'https://bar.com')
  })

  await run('javascript: scheme is NOT linked (security)', () => {
    const result = linkifyText('javascript:alert(1)')
    assert.equal(result.length, 1)
    assert.equal(typeof result[0], 'string')
    assert.equal(React.isValidElement(result[0]), false)
  })

  await run('data: scheme is NOT linked (security)', () => {
    const result = linkifyText('data:text/html,<h1>xss</h1>')
    assert.equal(result.length, 1)
    assert.equal(typeof result[0], 'string')
    assert.equal(React.isValidElement(result[0]), false)
  })

  await run('HTML special chars in plain text returned as raw string (React escapes at render)', () => {
    const result = linkifyText('<script>alert("xss")</script>')
    assert.equal(result.length, 1)
    assert.equal(typeof result[0], 'string')
    // Returned as-is; React text node rendering escapes this automatically — no dangerouslySetInnerHTML
    assert.equal(result[0], '<script>alert("xss")</script>')
  })

  await run('empty string returns single empty-string segment', () => {
    const result = linkifyText('')
    assert.equal(result.length, 1)
    assert.equal(result[0], '')
  })

  console.log('linkify tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
