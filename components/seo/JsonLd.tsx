// JSON-LD構造化データコンポーネント

interface OrganizationJsonLdProps {
  name: string
  url: string
  logo?: string
  description?: string
}

export function OrganizationJsonLd({ name, url, logo, description }: OrganizationJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    ...(logo && { logo }),
    ...(description && { description }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

interface LocalBusinessJsonLdProps {
  name: string
  address: string
  url: string
  telephone?: string
  openingHours?: string
  aggregateRating?: {
    ratingValue: number
    reviewCount: number
  }
  geo?: {
    latitude: number
    longitude: number
  }
}

export function LocalBusinessJsonLd({
  name,
  address,
  url,
  telephone,
  openingHours,
  aggregateRating,
  geo,
}: LocalBusinessJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': url,
    name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressCountry: 'JP',
    },
    url,
    ...(telephone && { telephone }),
    ...(openingHours && { openingHours }),
    ...(aggregateRating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: aggregateRating.ratingValue,
        reviewCount: aggregateRating.reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
    ...(geo && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: geo.latitude,
        longitude: geo.longitude,
      },
    }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

interface EventJsonLdProps {
  name: string
  startDate: string
  endDate?: string
  location?: {
    name?: string
    address?: string
  }
  description?: string
  url: string
  organizer?: string
  offers?: {
    price?: string
    priceCurrency?: string
  }
}

export function EventJsonLd({
  name,
  startDate,
  endDate,
  location,
  description,
  url,
  organizer,
  offers,
}: EventJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    startDate,
    ...(endDate && { endDate }),
    ...(location && {
      location: {
        '@type': 'Place',
        name: location.name || location.address,
        ...(location.address && {
          address: {
            '@type': 'PostalAddress',
            streetAddress: location.address,
            addressCountry: 'JP',
          },
        }),
      },
    }),
    ...(description && { description }),
    url,
    ...(organizer && {
      organizer: {
        '@type': 'Organization',
        name: organizer,
      },
    }),
    ...(offers && {
      offers: {
        '@type': 'Offer',
        price: offers.price || '0',
        priceCurrency: offers.priceCurrency || 'JPY',
        availability: 'https://schema.org/InStock',
      },
    }),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

interface ArticleJsonLdProps {
  headline: string
  datePublished: string
  dateModified?: string
  author: {
    name: string
    url?: string
  }
  url: string
  image?: string
  description?: string
}

export function ArticleJsonLd({
  headline,
  datePublished,
  dateModified,
  author,
  url,
  image,
  description,
}: ArticleJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    datePublished,
    ...(dateModified && { dateModified }),
    author: {
      '@type': 'Person',
      name: author.name,
      ...(author.url && { url: author.url }),
    },
    url,
    ...(image && { image }),
    ...(description && { description }),
    publisher: {
      '@type': 'Organization',
      name: 'BON-LOG',
      url: process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

interface BreadcrumbJsonLdProps {
  items: Array<{
    name: string
    url: string
  }>
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

interface WebSiteJsonLdProps {
  name: string
  url: string
  description?: string
  searchUrl?: string
}

export function WebSiteJsonLd({ name, url, description, searchUrl }: WebSiteJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    ...(description && { description }),
    ...(searchUrl && {
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${searchUrl}?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
