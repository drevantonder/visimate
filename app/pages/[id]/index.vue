<script setup lang="ts">
import { z } from 'zod';
import type { TableColumn } from '@nuxt/ui';

const route = useRoute();
const id = route.params.id as string;

const categoryToModeMap: Record<string, string> = {
  'Cafe': 'food-beverage',
  'Restaurant': 'food-beverage',
  'Takeaway': 'food-beverage',
  'Bar': 'food-beverage',
  'Bakery': 'food-beverage',
};

const { data: business } = await useFetch<Business>(`/api/businesses/${id}`);

const mode = computed(() => {
  const bCategory = business.value?.category;
  if (bCategory && categoryToModeMap[bCategory]) {
    return categoryToModeMap[bCategory];
  }
  return 'food-beverage'; // Default mode
});

// Definition of check weights by business mode (out of 100 total points)
const modeCheckWeights: Record<string, Record<string, number>> = {
  'food-beverage': {
    // Google Business Profile (31 points total)
    'google-listing': 8,
    'google-listing-primary-category': 4,
    'google-listing-opening-times': 3,
    'google-listing-website-matches': 3,
    'google-listing-phone-number': 2,
    'google-listing-photos': 3,

    // Core site hygiene & UX (25 points total)
    'website': 6, // Site exists (treating as HTTPS check)
    'website-200-299': 6,
    'website-mobile-responsive': 6,
    'website-performance': 6, // First Contentful Paint
    'website-menu-page': 4, // Menu page exists
    'website-menu-navigation': 3, // Menu in navigation

    // Structured data & on-page SEO (17 points total)
    'website-localbusiness-jsonld': 3,
    'website-menu-jsonld': 2,
    'website-title': 5,
    'website-meta-description': 2,
    'website-canonical': 1,
    'website-robots': 1,
    'website-sitemap': 1,

    // Social proof & conversion cues (18 points total)
    'google-listing-reviews': 5, // Rating and # of reviews
    'website-tel-link': 1,
    'website-og-image': 1,
    'instagram-profile': 3,
    'facebook-page': 3,

    // Website ↔ GBP parity (10 points total)
    'website-gbp-name-address-phone': 6,
    'website-physical-address': 2,
    'website-opening-hours': 2
  },
  'tradie': {
  },
  'retail': {
  },
  'health-wellness': {
  },
  'pet': {
  }
};

// Default to food-beverage if no mode is selected
const checkWeights = computed(() => {
  return modeCheckWeights[mode.value];
});

const resultSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('check'),
    label: z.string().optional(),
    value: z.boolean().nullable().default(null),
  }),
])

const checkSchema = z.object({
  id: z.string(),
  name: z.string(),
  channel: z.string(),
  status: z.enum(['idle', 'pending', 'pass', 'fail', 'error']),
  result: resultSchema.nullable().default(null),
  weight: z.number().default(1), // Weight for this check in the scoring system
  startTime: z.number().optional(), // Timestamp when check started
  endTime: z.number().optional(), // Timestamp when check completed
  duration: z.number().optional() // Duration in milliseconds
})

type Check = z.infer<typeof checkSchema>

const checks = ref<Check[]>([])

// Centralized check definitions
const allCheckDefinitions = [
  // Google Business Profile checks
  { id: 'google-listing', name: 'Google Business Profile (GBP) exists', channel: 'Google Business Profile' },
  { id: 'google-listing-primary-category', name: 'GBP primary category is set', channel: 'Google Business Profile' },
  { id: 'google-listing-opening-times', name: 'GBP opening hours are present', channel: 'Google Business Profile' },
  { id: 'google-listing-website-matches', name: 'GBP website URL matches the scanned site', channel: 'Google Business Profile' },
  { id: 'google-listing-phone-number', name: 'GBP phone number matches the site', channel: 'Google Business Profile' },
  { id: 'google-listing-photos', name: '≥ 3 photos on GBP (food or venue)', channel: 'Google Business Profile' },
  { id: 'google-listing-reviews', name: 'Google rating ≥ 4.0 and ≥ 20 reviews', channel: 'Google Business Profile' },

  // Core site hygiene & UX
  { id: 'website', name: 'Site enforces HTTPS', channel: 'Website' },
  { id: 'website-200-299', name: 'Site returns 200-299 status codes', channel: 'Website' },
  { id: 'website-mobile-responsive', name: 'Site is mobile-responsive', channel: 'Website' },
  { id: 'website-performance', name: 'Median First Contentful Paint ≤ 3s', channel: 'Website' },

  // Structured data & on-page SEO
  { id: 'website-localbusiness-jsonld', name: 'LocalBusiness JSON-LD detected', channel: 'Website' },
  { id: 'website-menu-jsonld', name: 'Menu JSON-LD detected', channel: 'Website', modes: ['food-beverage'] },
  { id: 'website-title', name: '<title> contains business name + suburb/city', channel: 'Website' },
  { id: 'website-meta-description', name: '<meta description> present (≤ 160 chars)', channel: 'Website' },
  { id: 'website-canonical', name: '<link rel="canonical"> present on every page', channel: 'Website' },
  { id: 'website-robots', name: 'robots.txt does not block the homepage', channel: 'Website' },
  { id: 'website-sitemap', name: 'Sitemap file discoverable', channel: 'Website' },

  // Social proof & conversion cues
  { id: 'website-tel-link', name: 'Click-to-call tel: link on site', channel: 'Website' },
  { id: 'website-og-image', name: 'og:image (Open-Graph preview) present', channel: 'Website' },
  { id: 'instagram-profile', name: 'Has an Instagram profile', channel: 'Social Media' },
  { id: 'facebook-page', name: 'Has a Facebook page', channel: 'Social Media' },
  { id: 'tiktok-profile', name: 'Has a TikTok profile', channel: 'Social Media' },

  // Website ↔ GBP parity
  { id: 'website-gbp-name-address-phone', name: 'Website name, address & phone match GBP', channel: 'Website' },
  { id: 'website-physical-address', name: 'Physical address printed in header/footer', channel: 'Website' },
  { id: 'website-opening-hours', name: 'Opening hours printed on the website', channel: 'Website' },

  // Food delivery platforms
  { id: 'uber-eats-listing', name: 'Uber Eats Listing', channel: 'Food Delivery', modes: ['food-beverage'] },
  { id: 'menulog-listing', name: 'Menulog Listing', channel: 'Food Delivery', modes: ['food-beverage'] },
  { id: 'doordash-listing', name: 'DoorDash Listing', channel: 'Food Delivery', modes: ['food-beverage'] },
  { id: 'deliveroo-listing', name: 'Deliveroo Listing', channel: 'Food Delivery', modes: ['food-beverage'] },
]

// Filter checks based on the current mode
const activeCheckDefinitions = computed(() => {
  return allCheckDefinitions.filter(def =>
    !def.modes || def.modes.includes(mode.value)
  )
})

const addCheck = async (name: string, checkId: string, channel: string) => {
  // Get the weight for this check, or default to 1
  const weight = checkWeights.value?.[checkId] || 1

  const startTime = Date.now()
  const check: Ref<Check> = ref(checkSchema.parse({
    id: checkId,
    name,
    channel,
    status: 'pending',
    weight,
    startTime
  }))
  checks.value.push(unref(check))
  try {
    const result = await $fetch(`/api/businesses/${id}/checks/${checkId}`)
    const endTime = Date.now()
    check.value.endTime = endTime
    check.value.duration = endTime - startTime
    check.value.result = resultSchema.parse(result)
    // Set status based on result value
    if (check.value.result?.type === 'check') {
      check.value.status = check.value.result.value === true ? 'pass' : 'fail'
    } else {
      check.value.status = 'error'
    }
  } catch (error) {
    console.error('Error adding check:', error)
    check.value.status = 'error'
    const endTime = Date.now()
    check.value.endTime = endTime
    check.value.duration = endTime - startTime
  }
}

// Dynamically load checks based on mode
watchEffect(() => {
  // Clear existing checks
  checks.value = []

  // Add all active checks for the current mode
  activeCheckDefinitions.value.forEach(def => {
    addCheck(def.name, def.id, def.channel)
  })
})

// Organize checks by channel
const channelChecks = computed<Record<string, Check[]>>(() => {
  const channels: Record<string, Check[]> = {}

  // Group checks by channel
  checks.value.forEach(check => {
    const channelName = check.channel || 'Uncategorized'
    if (!channels[channelName]) {
      channels[channelName] = []
    }
    channels[channelName].push(check)
  })

  return channels
})

type ChannelStatus = {
  name: string;
  status: 'active' | 'warning' | 'missing';
  score: number;
  total: number;
  percentage: number;
}

// Calculate channel status for scorecard
const channelStatus = computed<ChannelStatus[]>(() => {
  return Object.entries(channelChecks.value).map(([name, items]) => {
    let status: 'active' | 'warning' | 'missing' = 'missing'
    let score = 0
    let totalWeight = 0

    if (items.length) {
      // Count successful checks, factoring in their weights
      items.forEach(item => {
        totalWeight += item.weight
        if (item.status === 'pass') {
          score += item.weight
        }
      })

      const active = items.some(i => i.status === 'pass')
      const warning = items.some(i => i.status === 'fail' || i.status === 'error')

      if (active) status = 'active'
      else if (warning) status = 'warning'
    }

    const percentage = totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0

    return { name, status, score, total: totalWeight, percentage }
  })
})

// Total implementation score
const totalImplementationScore = computed(() => {
  // Calculate total weight of all checks
  const totalWeight = checks.value.reduce((acc, check) => acc + check.weight, 0)
  // Calculate scored weight based on check results
  const scoredWeight = checks.value.reduce((acc, check) => {
    return acc + (check.status === 'pass' ? check.weight : 0)
  }, 0)
  // Compute percentage using the critical score algorithm
  const percentage = totalWeight > 0 ? (scoredWeight / totalWeight) * 100 : 0

  return {
    score: Math.round(percentage),
    total: 100,
    percentage: Math.round(percentage)
  }
})

// Track total time taken for all checks (end of last check - start of first check)
const totalCheckTime = computed(() => {
  const completedChecks = checks.value.filter(check => check.startTime !== undefined && check.endTime !== undefined)
  if (completedChecks.length === 0) return 0

  const firstStartTime = Math.min(...completedChecks.map(check => check.startTime || Infinity))
  const lastEndTime = Math.max(...completedChecks.map(check => check.endTime || 0))

  return lastEndTime - firstStartTime
})

const getChannelPrimaryColor = (channel: string) => {
  const colorMap: Record<string, string> = {
    'Google Business Profile': 'bg-green-500',
    'Website': 'bg-purple-500',
    'Social Media': 'bg-blue-500',
    'Food Delivery': 'bg-yellow-500',
    'Service Platforms': 'bg-purple-500',
    'Marketplaces': 'bg-teal-500',
    'Booking Platforms': 'bg-rose-500',
    'Pet Platforms': 'bg-indigo-500'
  }
  return colorMap[channel] || 'bg-gray-500'
}

const activeChannel = ref('all')

// Custom sort function for status column to prioritize fails
const statusSortingFn = (rowA: any, rowB: any, columnId: string): number => {
  // Order: fail, error, pending, pass
  const statusOrder: Record<string, number> = {
    'fail': 0,
    'error': 1,
    'pending': 2,
    'pass': 3,
    'idle': 4
  }

  // Safely get status values with fallbacks
  let statusValueA: string = 'pending'
  let statusValueB: string = 'pending'

  try {
    if (rowA && typeof rowA.getValue === 'function') {
      statusValueA = rowA.getValue(columnId) || 'pending'
    }

    if (rowB && typeof rowB.getValue === 'function') {
      statusValueB = rowB.getValue(columnId) || 'pending'
    }
  } catch (error) {
    console.error('Error in status sorting function:', error)
  }

  // Get numeric values with fallback to pending (2)
  const orderA = statusOrder[statusValueA] ?? 2
  const orderB = statusOrder[statusValueB] ?? 2

  return orderA - orderB
}

const columns: TableColumn<Check>[] = [
  {
    id: 'expand',
  },
  {
    accessorKey: 'channel',
    header: 'Channel',
  },
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'weight',
    header: () => h('div', { class: 'text-right' }, 'Weight'),
  },
  {
    accessorKey: 'duration',
    header: () => h('div', { class: 'text-right' }, 'Time'),
  },
  {
    accessorKey: 'status',
    header: () => h('div', { class: 'text-right' }, 'Status'),
    sortingFn: statusSortingFn,
  },
  {
    id: 'actions',
  },
]

const formatTime = (time: number) => {
  if (time < 1000) {
    return `${time}ms`
  }
  return `${(time / 1000).toFixed(1)}s`
}

// For A4 styling
const todayDate = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// Get status colors for semantic UI
const getStatusColor = (status: string) => {
  switch (status) {
    case 'pass': return 'success'
    case 'fail': return 'error'
    case 'error': return 'warning'
    case 'pending': return 'neutral'
    default: return 'neutral'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pass': return 'i-lucide-check'
    case 'fail': return 'i-lucide-x'
    case 'error': return 'i-lucide-bug'
    case 'pending': return 'i-lucide-loader'
    default: return 'i-lucide-help-circle'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pass': return 'Pass'
    case 'fail': return 'Fail'
    case 'error': return 'Error'
    case 'pending': return 'Pending'
    default: return 'Unknown'
  }
}

const channelFilterItems = computed(() => {
  return [{
    label: 'All',
    value: 'all'
  }, ...Object.keys(channelChecks.value).map(name => ({
    label: name,
    value: name
  }))
  ]
})

// Add refresh method to reload all checks
const refreshChecks = () => {
  // Clear existing checks
  checks.value = []

  // Add all active checks for the current mode
  activeCheckDefinitions.value.forEach(def => {
    addCheck(def.name, def.id, def.channel)
  })
}

const columnFilters = computed(() => {
  if (activeChannel.value === 'all') {
    return []
  }
  return [
    {
      id: 'channel',
      value: activeChannel.value
    }
  ]
})

// Default sort order - sort by status first (fails first), then by weight
const sorting = ref([
  {
    id: 'status',
    desc: false
  },
  {
    id: 'weight',
    desc: true
  }
])

const table = useTemplateRef('table')

// Define interface for check details
interface CheckDetail {
  what: string;
  issues: string;
  fix: string;
  impact: string;
}

const checkDetails = ref<Record<string, CheckDetail>>({
  'google-listing': {
    what: `<p>Checks if your business is listed and visible on <strong>Google Business Profile</strong> (Google Maps & Search).</p>`,
    issues: `<ul>
      <li>Customers can't find your business when searching locally.</li>
      <li>Missing critical info (hours, directions) means lost sales.</li>
    </ul>`,
    fix: `<ol>
      <li>Visit <a href="https://business.google.com">business.google.com</a> and add your business details.</li>
      <li>Complete Google's simple verification.</li>
      <li>Optimize your profile for better visibility.</li>
    </ol>`,
    impact: `<ul>
      <li>Appear in local searches and gain immediate visibility.</li>
      <li>Get more clicks, calls, and visits.</li>
    </ul>`
  },

  'google-listing-primary-category': {
    what: `<p>Ensures your business's <strong>primary category</strong> matches exactly what you offer.</p>`,
    issues: `<ul>
      <li>Less visibility or irrelevant search results.</li>
      <li>Lost customers who can't find you for specific services.</li>
    </ul>`,
    fix: `<ol>
      <li>Select the most accurate category in your Google profile.</li>
    </ol>`,
    impact: `<ul>
      <li>Show up clearly in relevant searches.</li>
      <li>Increase customer engagement and visits.</li>
    </ul>`
  },

  'google-listing-opening-times': {
    what: `<p>Confirms your opening and closing times are clearly listed.</p>`,
    issues: `<ul>
      <li>Confusion or negative reviews if customers can't find your hours.</li>
      <li>Lost business from unclear availability.</li>
    </ul>`,
    fix: `<ol>
      <li>Update your opening hours regularly in your Google profile.</li>
    </ol>`,
    impact: `<ul>
      <li>Customers trust and easily visit during correct hours.</li>
      <li>Reduced confusion and better Google ranking.</li>
    </ul>`
  },

  'google-listing-website-matches': {
    what: `<p>Checks that the website link on Google matches your official site exactly.</p>`,
    issues: `<ul>
      <li>Customers landing on incorrect or broken sites.</li>
      <li>Loss of trust and fewer online conversions.</li>
    </ul>`,
    fix: `<ol>
      <li>Ensure your Google profile website matches your main website exactly.</li>
    </ol>`,
    impact: `<ul>
      <li>Smooth customer journey from search to your website.</li>
      <li>Higher trust and more conversions.</li>
    </ul>`
  },

  'google-listing-phone-number': {
    what: `<p>Ensures your listed phone number matches your website.</p>`,
    issues: `<ul>
      <li>Missed or misdirected customer calls.</li>
      <li>Lower Google ranking from mismatched info.</li>
    </ul>`,
    fix: `<ol>
      <li>Update your phone number in Google to match your website exactly.</li>
    </ol>`,
    impact: `<ul>
      <li>Fewer missed calls, higher customer trust.</li>
      <li>Better ranking and visibility on Google.</li>
    </ul>`
  },

  'google-listing-photos': {
    what: `<p>Verifies at least three quality photos are uploaded.</p>`,
    issues: `<ul>
      <li>Listings without photos get overlooked.</li>
      <li>Customers less likely to engage.</li>
    </ul>`,
    fix: `<ol>
      <li>Upload clear, attractive photos of your business to your Google profile.</li>
    </ol>`,
    impact: `<ul>
      <li>Attract more clicks and engagement.</li>
      <li>Increased trust and visibility online.</li>
    </ul>`
  },

  'google-listing-reviews': {
    what: `<p>Checks your listing has at least 20 reviews averaging 4 stars or higher.</p>`,
    issues: `<ul>
      <li>Fewer clicks and lost customers due to low trust.</li>
      <li>Poor ranking and visibility.</li>
    </ul>`,
    fix: `<ol>
      <li>Encourage happy customers to review your business.</li>
      <li>Respond professionally to all reviews.</li>
    </ol>`,
    impact: `<ul>
      <li>Higher credibility and more customers.</li>
      <li>Improved local search ranking.</li>
    </ul>`
  },

  'website': {
    what: `<p>Checks if your website uses secure <strong>HTTPS</strong> (padlock icon).</p>`,
    issues: `<ul>
      <li>Customers may avoid your site due to security warnings.</li>
      <li>Your site's ranking and trust can be reduced.</li>
    </ul>`,
    fix: `<ol>
      <li>Install an SSL certificate through your hosting provider.</li>
      <li>Ensure all pages redirect to HTTPS securely.</li>
    </ol>`,
    impact: `<ul>
      <li>Improved customer trust and higher rankings on Google.</li>
      <li>Secure browsing experience for visitors.</li>
    </ul>`
  },

  'website-200-299': {
    what: `<p>Checks that your website consistently loads without errors (status codes 200-299).</p>`,
    issues: `<ul>
      <li>Customers face broken pages or errors.</li>
      <li>Decreased trust and lost conversions.</li>
    </ul>`,
    fix: `<ol>
      <li>Fix broken links or pages causing errors.</li>
      <li>Regularly monitor your site for uptime and errors.</li>
    </ol>`,
    impact: `<ul>
      <li>Smooth browsing experience and reliable access.</li>
      <li>Higher customer satisfaction and conversions.</li>
    </ul>`
  },

  'website-mobile-responsive': {
    what: `<p>Ensures your website works well on smartphones and tablets.</p>`,
    issues: `<ul>
      <li>Customers have trouble navigating your site on mobile.</li>
      <li>Lost sales from mobile visitors.</li>
    </ul>`,
    fix: `<ol>
      <li>Use a responsive website design that adapts automatically.</li>
      <li>Test your site on various mobile devices.</li>
    </ol>`,
    impact: `<ul>
      <li>Enhanced user experience on all devices.</li>
      <li>Improved conversions and Google rankings.</li>
    </ul>`
  },

  'website-performance': {
    what: `<p>Checks your website loads quickly, with content visible in under 3 seconds.</p>`,
    issues: `<ul>
      <li>Customers abandon slow-loading pages.</li>
      <li>Lower search engine ranking and reduced visibility.</li>
    </ul>`,
    fix: `<ol>
      <li>Optimize images, scripts, and website code for speed.</li>
      <li>Use performance testing tools to monitor improvements.</li>
    </ol>`,
    impact: `<ul>
      <li>Faster loading improves customer retention.</li>
      <li>Better search rankings and higher engagement.</li>
    </ul>`
  },

  'website-localbusiness-jsonld': {
    what: `<p>Confirms structured data for <strong>LocalBusiness</strong> is included on your site.</p>`,
    issues: `<ul>
      <li>Your business may be less visible in local search results.</li>
      <li>Lower trust from Google about your business details.</li>
    </ul>`,
    fix: `<ol>
      <li>Add LocalBusiness JSON-LD structured data to your website.</li>
    </ol>`,
    impact: `<ul>
      <li>Enhanced visibility in local search results.</li>
      <li>Improved search engine trust and ranking.</li>
    </ul>`
  },

  'website-menu-jsonld': {
    what: `<p>Verifies your menu items are correctly structured using JSON-LD for food businesses.</p>`,
    issues: `<ul>
      <li>Your menu might not appear prominently in Google searches.</li>
      <li>Lost opportunities from customers looking for specific dishes.</li>
    </ul>`,
    fix: `<ol>
      <li>Implement Menu JSON-LD structured data on your menu pages.</li>
    </ol>`,
    impact: `<ul>
      <li>Improved visibility of your menu items in search results.</li>
      <li>Higher customer engagement and click-through rates.</li>
    </ul>`
  },

  'website-title': {
    what: `<p>Checks your website's page titles include your business name and suburb/city clearly.</p>`,
    issues: `<ul>
      <li>Lower visibility in local search results.</li>
      <li>Missed opportunities to attract local customers.</li>
    </ul>`,
    fix: `<ol>
      <li>Update your website titles to include your business name and location.</li>
    </ol>`,
    impact: `<ul>
      <li>Better ranking and visibility in local search.</li>
      <li>Increased clicks from targeted local searches.</li>
    </ul>`
  },

  'website-meta-description': {
    what: `<p>Ensures your site includes concise meta descriptions (under 160 characters).</p>`,
    issues: `<ul>
      <li>Lower click-through rate from search results.</li>
      <li>Missed chance to clearly present your offerings.</li>
    </ul>`,
    fix: `<ol>
      <li>Write clear, concise meta descriptions under 160 characters.</li>
    </ol>`,
    impact: `<ul>
      <li>Improved click-through from Google.</li>
      <li>Enhanced clarity and appeal of your search snippets.</li>
    </ul>`
  },

  'website-canonical': {
    what: `<p>Confirms every webpage specifies a canonical URL.</p>`,
    issues: `<ul>
      <li>Potential duplicate content issues harming SEO.</li>
      <li>Reduced Google ranking due to confusion.</li>
    </ul>`,
    fix: `<ol>
      <li>Add canonical tags to all pages pointing clearly to your preferred URL.</li>
    </ol>`,
    impact: `<ul>
      <li>Better SEO performance and ranking clarity.</li>
      <li>Avoids duplicate content penalties.</li>
    </ul>`
  },

  'website-robots': {
    what: `<p>Checks your robots.txt file isn't blocking your homepage from search engines.</p>`,
    issues: `<ul>
      <li>Your homepage won't appear in search results.</li>
      <li>Significant loss of online visibility and traffic.</li>
    </ul>`,
    fix: `<ol>
      <li>Ensure robots.txt allows search engines to access your homepage.</li>
    </ol>`,
    impact: `<ul>
      <li>Ensures maximum visibility in search results.</li>
      <li>Increases traffic and potential conversions.</li>
    </ul>`
  },

  'website-sitemap': {
    what: `<p>Ensures your sitemap file is accessible to search engines.</p>`,
    issues: `<ul>
      <li>Your website pages may not be fully discovered by search engines.</li>
      <li>Lower search visibility and missed traffic.</li>
    </ul>`,
    fix: `<ol>
      <li>Create and submit a sitemap to Google Search Console.</li>
    </ol>`,
    impact: `<ul>
      <li>Full website indexing by search engines.</li>
      <li>Improved search rankings and visibility.</li>
    </ul>`
  },

  'website-tel-link': {
    what: `<p>Checks if your website includes clickable phone number links.</p>`,
    issues: `<ul>
      <li>Customers struggle to call directly from your site.</li>
      <li>Reduced convenience and potential loss of calls.</li>
    </ul>`,
    fix: `<ol>
      <li>Add click-to-call (tel:) links to your phone numbers on your website.</li>
    </ol>`,
    impact: `<ul>
      <li>Easier customer contact and increased phone conversions.</li>
      <li>Improved user experience.</li>
    </ul>`
  },

  'website-og-image': {
    what: `<p>Ensures your site has Open Graph images set for social sharing.</p>`,
    issues: `<ul>
      <li>Poor appearance when your site is shared on social media.</li>
      <li>Reduced clicks and social engagement.</li>
    </ul>`,
    fix: `<ol>
      <li>Add an appealing Open Graph (og:image) to your website pages.</li>
    </ol>`,
    impact: `<ul>
      <li>Increased visibility and clicks from social media.</li>
      <li>Enhanced professionalism and branding.</li>
    </ul>`
  },

  'instagram-profile': {
    what: `<p>Checks if your business has an active Instagram profile.</p>`,
    issues: `<ul>
      <li>Missed opportunity to engage customers visually.</li>
      <li>Reduced brand visibility among younger demographics.</li>
    </ul>`,
    fix: `<ol>
      <li>Create and regularly update an Instagram profile for your business.</li>
    </ol>`,
    impact: `<ul>
      <li>Greater brand exposure and customer interaction.</li>
      <li>Increased customer loyalty and visibility.</li>
    </ul>`
  },

  'facebook-page': {
    what: `<p>Checks if your business has an active Facebook page.</p>`,
    issues: `<ul>
      <li>Missed engagement opportunities with a large audience.</li>
      <li>Reduced credibility for customers checking social presence.</li>
    </ul>`,
    fix: `<ol>
      <li>Create and maintain an active Facebook page.</li>
    </ol>`,
    impact: `<ul>
      <li>Enhanced customer engagement and brand credibility.</li>
      <li>Improved online visibility and referrals.</li>
    </ul>`
  },

  'tiktok-profile': {
    what: `<p>Ensures your business maintains a TikTok profile.</p>`,
    issues: `<ul>
      <li>Missed opportunity to connect with younger audiences.</li>
      <li>Reduced competitive presence.</li>
    </ul>`,
    fix: `<ol>
      <li>Create engaging content regularly on TikTok.</li>
    </ol>`,
    impact: `<ul>
      <li>Increased reach and brand visibility among younger demographics.</li>
      <li>Higher engagement and potential customer growth.</li>
    </ul>`
  },

  'website-gbp-name-address-phone': {
    what: `<p>Checks if your website and Google profile have matching business details.</p>`,
    issues: `<ul>
      <li>Confusion from inconsistent information.</li>
      <li>Reduced trust from Google, affecting local rankings.</li>
    </ul>`,
    fix: `<ol>
      <li>Ensure business details (name, address, phone) match exactly on your website and Google profile.</li>
    </ol>`,
    impact: `<ul>
      <li>Increased trust and improved local search rankings.</li>
      <li>Enhanced customer clarity and conversions.</li>
    </ul>`
  },

  'website-physical-address': {
    what: `<p>Verifies your physical address is prominently displayed on your site.</p>`,
    issues: `<ul>
      <li>Customers struggle to find your physical location.</li>
      <li>Reduced Google local search ranking.</li>
    </ul>`,
    fix: `<ol>
      <li>Add your business address clearly in the website header or footer.</li>
    </ol>`,
    impact: `<ul>
      <li>Improved customer convenience and local SEO.</li>
      <li>Higher credibility and trust.</li>
    </ul>`
  },

  'website-opening-hours': {
    what: `<p>Checks your website clearly displays opening hours.</p>`,
    issues: `<ul>
      <li>Customers unclear about when you're open.</li>
      <li>Potential loss of visits or inquiries.</li>
    </ul>`,
    fix: `<ol>
      <li>Display your opening hours clearly on your website.</li>
    </ol>`,
    impact: `<ul>
      <li>Enhanced customer convenience and trust.</li>
      <li>Increased foot traffic and customer satisfaction.</li>
    </ul>`
  }
});

let originalExpanded: string[];
let originalActiveChannel: string;
let originalColorMode: string;
const beforePrint = (...args: any[]) => {
  if (!import.meta.client) return;

  // Before printing, minimise all rows and expand all failed/error rows
  originalExpanded = [];
  if (table?.value?.tableApi) {
    const rows = table.value.tableApi.getRowModel().rows;
    rows.forEach(row => {
      if (row.getIsExpanded()) {
        originalExpanded.push(row.id);
      }

      if (row.original.status === 'fail' || row.original.status === 'error') {
        row.toggleExpanded(true);
      } else {
        row.toggleExpanded(false);
      }
    });
  }

  originalActiveChannel = activeChannel.value;
  activeChannel.value = 'all';

  originalColorMode = colorMode.preference;
  colorMode.preference = 'light';
}

const afterPrint = () => {
  if (!import.meta.client) return;

  colorMode.preference = originalColorMode;
  activeChannel.value = originalActiveChannel;

  if (table?.value?.tableApi) {
    const rows = table.value.tableApi.getRowModel().rows;
    rows.forEach(row => {
      if (originalExpanded.includes(row.id)) {
        row.toggleExpanded(true);
      } else {
        row.toggleExpanded(false);
      }
    });
  }
}

onMounted(() => {
  window.addEventListener('beforeprint', beforePrint);
  window.addEventListener('afterprint', afterPrint);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeprint', beforePrint);
  window.removeEventListener('afterprint', afterPrint);
})

const colorMode = useColorMode();
const print = () => {
  if (!import.meta.client) return;

  // Remove the event listener to prevent duplicate calls
  window.removeEventListener('beforeprint', beforePrint);
  beforePrint();

  // Wait for the next tick to ensure DOM updates
  nextTick(() => {
    window.print();
    
    window.addEventListener('beforeprint', beforePrint);
  });
}
</script>c

<template>
  <UContainer as="main" v-if="business" class="py-6">
    <UBreadcrumb :items="[
      {
    label: 'Home',
    icon: 'i-lucide-house',
    to: '/'
  },
      {
        label: business.name,
        icon: 'i-lucide-building',
        to: `/${business.id}/`
      }
    ]" />

    <div class="flex items-center justify-between print:flex-col print:gap-2 mt-2">
      <h1 class="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">{{ business.name }}</h1>
      <div class="hidden print:block text-xs text-gray-500 leading-none">{{ todayDate }}</div>

      <div class="flex items-center gap-2 print:hidden">
        <UButton icon="i-lucide-download" color="neutral" variant="ghost" aria-label="Download PDF" @click="print()">
          Download / Print
        </UButton>

        <UButton icon="i-lucide-pencil" color="neutral" variant="soft" class="print:hidden" :to="`/${business.id}/edit/`"
            >
            Edit
          </UButton>

        <UButton icon="i-lucide-refresh-ccw" color="neutral" variant="solid" aria-label="Refresh Report"
          @click="refreshChecks">
          Refresh
        </UButton>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-8 mt-8">
      <UCard variant="subtle" class="col-span-1">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-xl font-bold">{{ business.name }}</h2>

          <UButton icon="i-lucide-pencil" color="neutral" variant="link" class="print:hidden" :to="`/${business.id}/edit/`"
            >
            Edit
          </UButton>
        </div>
        
        <BusinessChannels :business="business" class="mt-4">
          <UBadge color="neutral" variant="subtle" class="text-sm" leading-icon="i-lucide-coffee">
            {{ business.category }}
          </UBadge>
        </BusinessChannels>
      </UCard>

      <div
        class="col-span-1 row-start-2 rounded-lg bg-primary-50/50 dark:bg-primary-950/50 ring ring-primary-300/50 dark:ring-primary-900/50 p-6 flex flex-col items-start">
        <div class="text-xl font-bold">Need a hand?</div>

        <p class="dark:text-gray-100 text-gray-700 mt-2 text-sm">
          We've helped countless businesses just like yours fix these issues <strong>fast</strong>. Chat with an
          expert who can guide you.
        </p>

        <div class="mt-auto pt-4 flex items-center gap-3">
          <UButton color="primary" variant="soft" size="lg" class="print:hidden" to="/chat" icon="i-lucide-headset"
            trailing-icon="i-lucide-arrow-right">
            <span>Schedule a <strong><em>free</em></strong> chat</span>
          </UButton>
          <NuxtLink to="https://visimate.au/chat" external class="hidden print:block">
            <QR to="https://visimate.au/chat" :size="56" />
          </NuxtLink>
          <ULink to="https://visimate.au/chat" external class="hidden print:block">
            visimate.au/chat
          </ULink>
        </div>
      </div>

      <UCard variant="subtle" class="col-span-2 row-span-2">
        <h2 class="sr-only">Summary</h2>

        <div class="flex flex-col items-center gap-8">
          <div class="flex flex-col items-center gap-4">
            <CircularProgress :percentage="totalImplementationScore.percentage" class="size-40 print:size-24" />

            <div class="text-xl font-bold">Overall Score</div>
          </div>

          <div class="grid grid-cols-4 gap-4">
            <div class="flex flex-col items-center gap-2">
              <CircularProgress
                :percentage="channelStatus.find(s => s.name === 'Google Business Profile')?.percentage || 0"
                class="size-20" />
              <div class="text-base font-bold">Google Business Profile</div>
            </div>

            <div class="flex flex-col items-center gap-2">
              <CircularProgress :percentage="channelStatus.find(s => s.name === 'Website')?.percentage || 0"
                class="size-20" />
              <div class="text-base font-bold">Website</div>
            </div>

            <div class="flex flex-col items-center gap-2">
              <CircularProgress :percentage="channelStatus.find(s => s.name === 'Social Media')?.percentage || 0"
                class="size-20" />
              <div class="text-base font-bold">Social Media</div>
            </div>

            <div class="flex flex-col items-center gap-2">
              <CircularProgress :percentage="channelStatus.find(s => s.name === 'Food Delivery')?.percentage || 0"
                class="size-20" />
              <div class="text-base font-bold">Food Delivery</div>
            </div>
          </div>
        </div>
      </UCard>

      <UCard variant="subtle" class="col-span-3">
        <h2 class="sr-only">Checks</h2>

        <UTabs size="md" variant="link" :content="false" :items="channelFilterItems" v-model="activeChannel"
          class="w-full print:hidden">
          <template #trailing="{ item }">
            <UBadge v-if="item.value !== 'all'"
              :color="getStatusColor(channelStatus.find(s => s.name === item.value)?.status || 'missing')"
              variant="subtle">
              {{channelStatus.find(s => s.name === item.value)?.score || 0}}/{{channelStatus.find(s => s.name ===
                item.value)?.total || 0}}
            </UBadge>
          </template>
        </UTabs>

        <UTable :data="checks" :columns="columns" class="mb-0" v-model:column-filters="columnFilters"
          v-model:sorting="sorting" ref="table" :ui="{ tr: 'data-[expanded=true]:bg-elevated/50' }">
          <template #expand-cell="{ row }">
            <UButton icon="i-lucide-chevron-down" color="neutral" variant="ghost" square @click="row.toggleExpanded()"
              aria-label="Expand to view fix instructions and check information"
              :ui="{ leadingIcon: ['transition-transform', row.getIsExpanded() ? 'duration-200 rotate-180' : ''] }" />
          </template>
          <template #name-cell="{ row }">
            {{ row.original.name }}
          </template>
          <template #channel-cell="{ row }">
            <div class="flex items-center gap-1.5">
              <span :class="getChannelPrimaryColor(row.original.channel)" class="size-1.5 rounded-full mt-px"></span>
              {{ row.original.channel }}
            </div>
          </template>
          <template #weight-cell="{ row }">
            <div class="text-sm text-right">{{ row.original.weight }} pts</div>
          </template>
          <template #duration-cell="{ row }">
            <div class="text-sm text-right" v-if="row.original.duration">{{ formatTime(row.original.duration) }}</div>
            <div class="text-sm text-right" v-else>-</div>
          </template>
          <template #status-cell="{ row }">
            <div class="text-right">
              <UBadge :color="getStatusColor(row.original.status)" variant="soft" class="capitalize"
                :icon="getStatusIcon(row.original.status)"
                :ui="{ leadingIcon: row.original.status === 'pending' ? 'animate-spin' : '' }">
                {{ getStatusLabel(row.original.status) }}
              </UBadge>
            </div>
          </template>

          <template #actions-cell="{ row }">
            <div class="justify-end flex items-center gap-2 print:hidden">
              <UButton v-if="row.original.status === 'fail' || row.original.status === 'error'" icon="i-lucide-wrench"
                color="neutral" variant="link" @click="row.toggleExpanded()"
                aria-label="Expand to view fix instructions and check information">
                Fix
              </UButton>
            </div>
          </template>

          <template #expanded="{ row }">
            <div class="p-6 rounded-lg whitespace-normal"
              :class="{ 'print:hidden': !(row.original.status === 'fail' || row.original.status === 'error') }">
              <div v-if="row.original.result?.label" class="mb-4 text-sm italic">
                {{ row.original.result.label }}
              </div>

              <div v-if="checkDetails[row.original.id]">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div class="prose prose-sm dark:prose-invert max-w-none">
                    <div>
                      <h3>What is this check?</h3>
                      <div v-html="checkDetails[row.original.id]?.what" />
                    </div>

                    <div>
                      <h3>What issues may it cause?</h3>
                      <div v-html="checkDetails[row.original.id]?.issues" />
                    </div>
                  </div>

                  <div class="prose prose-sm dark:prose-invert max-w-none">
                    <div>
                      <h3>How do you fix it?</h3>
                      <div v-html="checkDetails[row.original.id]?.fix" />
                    </div>

                    <div>
                      <h3>What is the positive impact?</h3>
                      <div v-html="checkDetails[row.original.id]?.impact" />
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="text-sm text-gray-500 dark:text-gray-400 italic">
                No additional information available for this check.
              </div>
            </div>
          </template>
        </UTable>

        <div class="px-4 py-3.5 text-sm text-muted print:hidden">
          {{ table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }} of
          {{ table?.tableApi?.getFilteredRowModel().rows.length || 0 }} row(s) selected.
        </div>
      </UCard>
    </div>

    <!-- Footer -->
    <footer class="mt-6 py-4 text-center text-xs text-slate-500">
      <p>© {{ new Date().getFullYear() }} VisiMate | {{ (totalCheckTime / 1000).toFixed(1) }} seconds | Generated on {{
        todayDate }}</p>
    </footer>
  </UContainer>
</template>

<style>
@page {
  margin: 0;
}
</style>