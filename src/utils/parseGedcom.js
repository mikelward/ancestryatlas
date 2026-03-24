// Custom GEDCOM parser — parse-gedcom crashes on files with pointer-like
// values in CONC/CONT lines, so we roll our own lightweight parser.

function tokenize(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const records = []

  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(@[^@]+@\s+)?(\S+)\s?(.*)$/)
    if (!match) continue

    const level = parseInt(match[1], 10)
    const xref = match[2]?.trim() || null
    const tag = match[3]
    let value = match[4] || ''

    // Value might be a pointer reference like @I1@
    const pointer = value.match(/^@[^@]+@$/)?.[0] || null
    if (pointer) value = ''

    records.push({ level, xref, tag, value, pointer })
  }

  return records
}

function buildTree(tokens) {
  const root = { tag: 'ROOT', children: [] }
  const stack = [root]

  for (const token of tokens) {
    const node = {
      tag: token.tag,
      xref: token.xref,
      value: token.value,
      pointer: token.pointer,
      children: [],
    }

    // Pop stack until we find the parent level
    while (stack.length > token.level + 1) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]

    // Handle CONC (concatenation) and CONT (continuation)
    // These append to the parent node's value, not a sibling
    if (token.tag === 'CONC' || token.tag === 'CONT') {
      if (token.tag === 'CONT') {
        parent.value = (parent.value || '') + '\n' + (token.value || '')
      } else {
        parent.value = (parent.value || '') + (token.value || '')
      }
      continue
    }

    parent.children.push(node)
    stack[token.level + 1] = node
    // Truncate stack
    stack.length = token.level + 2
  }

  return root
}

function findChild(node, tag) {
  return node.children.find((c) => c.tag === tag) || null
}

function findChildValue(node, tag) {
  return findChild(node, tag)?.value || null
}

function findAllChildren(node, tag) {
  return node.children.filter((c) => c.tag === tag)
}

function extractIndividuals(tree) {
  const individuals = new Map()

  for (const node of tree.children) {
    if (node.tag !== 'INDI') continue
    const id = node.xref
    if (!id) continue

    const name = findChildValue(node, 'NAME')?.replace(/\//g, '').trim() || 'Unknown'

    const birthNode = findChild(node, 'BIRT')
    const birthDate = birthNode ? findChildValue(birthNode, 'DATE') : null
    const birthPlace = birthNode ? findChildValue(birthNode, 'PLAC') : null

    const deathNode = findChild(node, 'DEAT')
    const deathDate = deathNode ? findChildValue(deathNode, 'DATE') : null
    const deathPlace = deathNode ? findChildValue(deathNode, 'PLAC') : null

    const famcRefs = findAllChildren(node, 'FAMC').map((c) => c.pointer || c.value)
    const famsRefs = findAllChildren(node, 'FAMS').map((c) => c.pointer || c.value)

    const objeNode = findChild(node, 'OBJE')
    const photo = objeNode ? findChildValue(objeNode, 'FILE') : null

    individuals.set(id, {
      id,
      name,
      birthDate,
      birthPlace,
      deathDate,
      deathPlace,
      famcRefs,
      famsRefs,
      photo,
      parentIds: [],
      childIds: [],
    })
  }

  return individuals
}

function buildFamilyLinks(tree, individuals) {
  for (const node of tree.children) {
    if (node.tag !== 'FAM') continue

    const husbNode = findChild(node, 'HUSB')
    const wifeNode = findChild(node, 'WIFE')
    const husbId = husbNode?.pointer || husbNode?.value || null
    const wifeId = wifeNode?.pointer || wifeNode?.value || null
    const childIds = findAllChildren(node, 'CHIL').map(
      (c) => c.pointer || c.value
    )

    // Link children to parents
    for (const childId of childIds) {
      const child = individuals.get(childId)
      if (!child) continue
      if (husbId && individuals.has(husbId)) child.parentIds.push(husbId)
      if (wifeId && individuals.has(wifeId)) child.parentIds.push(wifeId)
    }

    // Link parents to children
    for (const pid of [husbId, wifeId].filter(Boolean)) {
      const parent = individuals.get(pid)
      if (!parent) continue
      for (const cid of childIds) {
        if (individuals.has(cid) && !parent.childIds.includes(cid)) {
          parent.childIds.push(cid)
        }
      }
    }
  }
}

function findRootPerson(individuals) {
  // Ancestry and most genealogy apps export the home person as the first INDI
  return individuals.keys().next().value
}

function collectDirectAncestors(individuals, rootId, maxGenerations = 4) {
  const result = new Map()
  const queue = [{ id: rootId, generation: 0 }]

  while (queue.length > 0) {
    const { id, generation } = queue.shift()
    if (!id || result.has(id) || !individuals.has(id)) continue
    if (generation > maxGenerations) continue

    const person = individuals.get(id)
    result.set(id, { ...person, generation })

    for (const parentId of person.parentIds) {
      if (!result.has(parentId)) {
        queue.push({ id: parentId, generation: generation + 1 })
      }
    }
  }

  return result
}

export function parseGedcom(gedcomText) {
  const tokens = tokenize(gedcomText)
  const tree = buildTree(tokens)
  const individuals = extractIndividuals(tree)
  buildFamilyLinks(tree, individuals)

  const rootId = findRootPerson(individuals)
  const ancestors = collectDirectAncestors(individuals, rootId, 4)

  const result = []
  for (const [id, person] of ancestors) {
    if (!person.birthPlace) continue

    const parents = person.parentIds
      .filter((pid) => ancestors.has(pid))
      .map((pid) => ({ id: pid, name: ancestors.get(pid).name }))

    const children = person.childIds
      .filter((cid) => ancestors.has(cid))
      .map((cid) => ({ id: cid, name: ancestors.get(cid).name }))

    result.push({
      id,
      name: person.name,
      birthDate: person.birthDate,
      birthPlace: person.birthPlace,
      deathDate: person.deathDate,
      deathPlace: person.deathPlace,
      photo: person.photo,
      generation: person.generation,
      parents,
      children,
    })
  }

  return result
}
