<script>
	import axios from 'axios'
	import { flip } from 'svelte/animate'
	import _ from 'lodash-es'
	import UI from '$lib/builder/ui'
	import site from '$lib/builder/stores/data/site.js'
	import active_page from '$lib/builder/stores/data/page.js'
	import symbols from '$lib/builder/stores/data/symbols.js'
	import { dragging_symbol } from '$lib/builder/stores/app/misc'
	import { site_design_css } from '$lib/builder/code_generators.js'
	import Sidebar_Symbol from './Sidebar_Symbol.svelte'
	import Content from '../Content.svelte'
	import { debounce } from '$lib/builder/utils'
	import { update_page_entries } from '$lib/builder/actions/pages.js'
	import { move_block } from '$lib/builder/actions/symbols'
	import { browser } from '$app/environment'
	import { goto } from '$app/navigation'
	import { dropTargetForElements } from '$lib/builder/libraries/pragmatic-drag-and-drop/entry-point/element/adapter.js'
	import { attachClosestEdge, extractClosestEdge } from '$lib/builder/libraries/pragmatic-drag-and-drop-hitbox/closest-edge.js'
	import { site_html } from '$lib/builder/stores/app/page'
	import { userRole } from '$lib/builder/stores/app/misc'
	import * as Tabs from '$lib/components/ui/tabs'
	import { Cuboid, SquarePen } from 'lucide-svelte'

	let active_tab = $state((browser && localStorage.getItem('page-tab')) || 'BLOCKS')

	let page_type_symbols = $derived($symbols.filter((s) => s.page_types.includes($active_page.page_type.id)))
	let has_symbols = $derived(page_type_symbols.length > 0)

	$effect(() => {
		if (!has_symbols) active_tab = 'CONTENT'
		else active_tab = 'BLOCKS'
	})

	function drag_target(element, block) {
		dropTargetForElements({
			element,
			getData({ input, element }) {
				return attachClosestEdge(
					{ block },
					{
						element,
						input,
						allowedEdges: ['top', 'bottom']
					}
				)
			},
			onDragStart() {
				$dragging_symbol = true
			},
			onDragEnd() {
				$dragging_symbol = false
			},
			onDrop({ self, source }) {
				$dragging_symbol = false
				const block_dragged_over_index = $symbols.find((s) => s.id === self.data.block.id).index
				const block_being_dragged = source.data.block
				const closestEdgeOfTarget = extractClosestEdge(self.data)
				if (closestEdgeOfTarget === 'top') {
					move_block(block_being_dragged, block_dragged_over_index)
				} else if (closestEdgeOfTarget === 'bottom') {
					move_block(block_being_dragged, block_dragged_over_index + 1)
				}
			}
		})
	}
</script>

<div class="sidebar primo-reset">
	{#if has_symbols}
		<Tabs.Root value="blocks" class="p-2">
			<Tabs.List class="w-full mb-2">
				<Tabs.Trigger value="blocks" class="flex-1 flex gap-1">
					<Cuboid class="w-3" />
					<span class="text-xs">Blocks</span>
				</Tabs.Trigger>
				<Tabs.Trigger value="content" class="flex-1 flex gap-1">
					<SquarePen class="w-3" />
					<span class="text-xs">Content</span>
				</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="blocks">
				<div class="symbols">
					{#if $site_html !== null}
						{#each page_type_symbols as symbol, i (symbol.id)}
							<div animate:flip={{ duration: 200 }} use:drag_target={symbol}>
								<Sidebar_Symbol {symbol} controls_enabled={false} head={$site_html} append={site_design_css($site.design)} />
							</div>
						{/each}
					{:else}
						<div style="display: flex;justify-content: center;font-size: 2rem;color:var(--color-gray-6)">
							<UI.Spinner variant="loop" />
						</div>
					{/if}
				</div>
				{#if $userRole === 'DEV'}
					<button onclick={() => goto(`/${$site.id}/page-type--${$active_page.page_type.id}?t=b`)} class="footer-link">Manage Blocks</button>
				{/if}
			</Tabs.Content>
			<Tabs.Content value="content">
				<div class="page-type-fields">
					<Content
						fields={$active_page.page_type.fields}
						entries={$active_page.entries}
						on:input={debounce({
							instant: ({ detail }) => update_page_entries.store(detail.updated),
							delay: ({ detail }) => update_page_entries.db(detail.original, detail.updated)
						})}
						minimal={true}
					/>
				</div>
				{#if $userRole === 'DEV'}
					<button onclick={() => goto(`/${$site.id}/page-type--${$active_page.page_type.id}?t=p`)} class="footer-link">Manage Fields</button>
				{/if}
			</Tabs.Content>
		</Tabs.Root>
	{:else}
		<div class="p-4 page-type-fields">
			<Content
				fields={$active_page.page_type.fields}
				entries={$active_page.entries}
				on:input={debounce({
					instant: ({ detail }) => update_page_entries.store(detail.updated),
					delay: ({ detail }) => update_page_entries.db(detail.original, detail.updated)
				})}
				minimal={true}
			/>
		</div>
		{#if $userRole === 'DEV'}
			<button onclick={() => goto(`/${$site.id}/page-type--${$active_page.page_type.id}?t=p`)} class="footer-link mb-2 mr-2">Manage Fields</button>
		{/if}
	{/if}
</div>

<style lang="postcss">
	.sidebar {
		width: 100%;
		/* background: #171717; */
		background: #111;
		z-index: 9;
		display: flex;
		flex-direction: column;
		height: 100%;
		flex: 1;
		/* gap: 0.5rem; */
		z-index: 9;
		position: relative;
		overflow: auto;
		/* padding-top: 0.5rem; */
	}

	.container {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		padding: 1rem;
		height: 100%;
		gap: 1rem;
	}

	.page-type-fields {
		flex: 1;
	}

	.symbols {
		gap: 1rem;
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	button.footer-link {
		font-size: 0.625rem;
		text-align: right;
		text-decoration: underline;
		color: var(--color-gray-4);
	}
</style>
