import { z } from 'zod'

export default defineCachedEventHandler(async (event) => {
  const token = await generateAppleMapKitToken(event)
  const { id } = await getValidatedRouterParams(event, z.object({ id: z.string() }).parse)

  try {
    const url = `https://maps-api.apple.com/v1/place/${id}`
    const params = new URLSearchParams({
      lang: 'en',
    })

    const data = await $fetch(`${url}?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    return ApplePlaceSchema.parse(data)
  } catch (error) {
    console.error('Apple Maps place lookup error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get Apple Maps place details',
    })
  }
}, {
  maxAge: 60 * 60 * 24,
})