import { describe, test, expect } from 'vitest'
import { listCompanies, setCompanyEnabled, deleteCompany, createCompany, parseCompanyTags } from '../../../../src/lib/db/companies.js'
import { mockSupabase as mockClient } from '../../../helpers/mockSupabase.js'

const FAIL = { data: null, error: { message: 'permission denied' } }

describe('companies db', () => {
  test('listCompanies returns rows ordered by name', async () => {
    const rows = [{ id: 'c1', name: 'Stripe' }]
    const client = mockClient({ data: rows, error: null })
    expect(await listCompanies(client)).toEqual(rows)
    expect(client.from).toHaveBeenCalledWith('companies')
    expect(client._chain.order).toHaveBeenCalledWith('name')
  })

  test('listCompanies throws rather than reporting an empty table', async () => {
    await expect(listCompanies(mockClient(FAIL))).rejects.toThrow('permission denied')
  })

  test('setCompanyEnabled writes the flag for one id', async () => {
    const client = mockClient({ data: null, error: null })
    await setCompanyEnabled(client, 'c1', false)
    expect(client._chain.update).toHaveBeenCalledWith({ enabled: false })
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'c1')
  })

  test('setCompanyEnabled throws on a rejected write', async () => {
    await expect(setCompanyEnabled(mockClient(FAIL), 'c1', false)).rejects.toThrow('permission denied')
  })

  test('deleteCompany deletes by id', async () => {
    const client = mockClient({ data: null, error: null })
    await deleteCompany(client, 'c1')
    expect(client._chain.delete).toHaveBeenCalled()
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'c1')
  })

  test('deleteCompany throws on a rejected delete', async () => {
    // A delete that silently fails is the worst of the three: the row vanishes
    // from the list optimistically and comes back on the next reload.
    await expect(deleteCompany(mockClient(FAIL), 'c1')).rejects.toThrow('permission denied')
  })

  test('parseCompanyTags drops empties and whitespace', () => {
    expect(parseCompanyTags(' startup, ai , ,')).toEqual(['startup', 'ai'])
    expect(parseCompanyTags('')).toEqual([])
    expect(parseCompanyTags(null)).toEqual([])
  })

  test('createCompany trims, parses tags and enables the row', async () => {
    const row = { id: 'new', name: 'Linear' }
    const client = mockClient({ data: row, error: null })
    const created = await createCompany(client, { slug: ' linear ', name: ' Linear ', ats: 'ashby', tags: 'startup, ai' })
    expect(created).toEqual(row)
    expect(client._chain.insert).toHaveBeenCalledWith({
      slug: 'linear', name: 'Linear', ats: 'ashby', tags: ['startup', 'ai'], enabled: true,
    })
  })

  test('createCompany accepts an already-parsed tag array', async () => {
    const client = mockClient({ data: { id: 'new' }, error: null })
    await createCompany(client, { slug: 's', name: 'n', ats: 'lever', tags: ['startup'] })
    expect(client._chain.insert).toHaveBeenCalledWith(expect.objectContaining({ tags: ['startup'] }))
  })

  test('createCompany throws on a rejected insert', async () => {
    await expect(
      createCompany(mockClient(FAIL), { slug: 's', name: 'n', ats: 'lever', tags: '' }),
    ).rejects.toThrow('permission denied')
  })
})
