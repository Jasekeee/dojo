import rawCampaigns from './campaigns.json'
import rawEpisodes from './time_machine_episodes.json'
import type { Episode } from './types'

export interface Campaign {
  id: string
  title: string
  subtitle: string
  period: string
  episodeIds: string[]
  summaryTemplate: string
}

export const campaigns: Campaign[] = rawCampaigns as Campaign[]
export const timeMachineEpisodes: Episode[] = rawEpisodes as Episode[]

export function getCampaignEpisodes(campaign: Campaign): Episode[] {
  return campaign.episodeIds
    .map((id) => timeMachineEpisodes.find((ep) => ep.id === id))
    .filter((ep): ep is Episode => ep !== undefined)
}
