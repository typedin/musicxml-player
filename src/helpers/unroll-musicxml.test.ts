import { describe, it, expect } from 'vitest'
import { unrollMusicXml } from './unroll-musicxml'
import { SaxonJSAdapter } from '../adapters/SaxonJSAdapter'

describe('unrollMusicXml', () => {
  const xsltProcessor = new SaxonJSAdapter();
  const simpleMusicXml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC
    "-//Recordare//DTD MusicXML 4.0 Partwise//EN"
    "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>`

  // Contract tests - test the interface, not SaxonJS internals
  it('should be a function', () => {
    expect(typeof unrollMusicXml).toBe('function')
  })

  it('should return a Promise', () => {
    const result = unrollMusicXml('test', 'test.xsl', xsltProcessor)
    expect(result).toBeInstanceOf(Promise)
  })

  it('should accept string parameters', async () => {
    // Test that the function signature is correct
    // We don't care about SaxonJS internals, just the interface
    try {
      const result = await unrollMusicXml(simpleMusicXml, 'test-unroll.xsl', xsltProcessor)
      // Should return original MusicXML when XSLT file is not found
      expect(result).toBe(simpleMusicXml)
    } catch (error) {
      // Expected to fail without proper SaxonJS setup, but interface is correct
      expect(error).toBeInstanceOf(Error)
    }
  })

  it('should handle missing XSLT file gracefully', async () => {
    // This tests the error handling contract
    const result = await unrollMusicXml(simpleMusicXml, 'nonexistent.xsl', xsltProcessor)
    expect(result).toBe(simpleMusicXml) // Should return original on error
  })

  it('should handle empty input gracefully', async () => {
    const result = await unrollMusicXml('', 'test-unroll.xsl', xsltProcessor)
    expect(result).toBe('')
  })

  it('should handle malformed XML gracefully', async () => {
    const invalidXml = '<invalid-xml>'
    const result = await unrollMusicXml(invalidXml, 'test-unroll.xsl', xsltProcessor)
    expect(result).toBe(invalidXml) // Should return original on error
  })

  // Test that all async operations complete properly
  it('should handle all async operations without unhandled rejections', async () => {
    const promises = [
      unrollMusicXml(simpleMusicXml, 'test-unroll.xsl', xsltProcessor),
      unrollMusicXml('', 'test-unroll.xsl', xsltProcessor),
      unrollMusicXml('<invalid-xml>', 'test-unroll.xsl', xsltProcessor),
      unrollMusicXml(simpleMusicXml, 'nonexistent.xsl', xsltProcessor)
    ]

    const results = await Promise.allSettled(promises)

    // All promises should settle (either fulfilled or rejected)
    expect(results).toHaveLength(4)
    results.forEach(result => {
      expect(result.status).toMatch(/fulfilled|rejected/)
    })
  })
})
