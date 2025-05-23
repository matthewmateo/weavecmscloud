<script>
	import _ from 'lodash-es'
	import { onMount } from 'svelte'
	import Primo from '$lib/builder/Primo.svelte'
	import { deploy_subscribe } from '$lib/builder/deploy.js'
	import { database_subscribe, storage_subscribe, realtime_subscribe, broadcast_subscribe } from '$lib/builder/database.js'
	import { locked_blocks, active_users } from '$lib/builder/stores/app/misc'
	import { show } from '$lib/components/Modal.svelte'
	import { supabase } from '$lib/supabase'
	import axios from 'axios'
	import { browser } from '$app/environment'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { invalidate } from '$app/navigation'
	import site from '$lib/builder/stores/data/site'

	let { data, children } = $props()

	deploy_subscribe(async (untyped_payload, action = 'PUBLISH') => {
		// workaround because adding the type next to the argument throws a parsing error (?)
		const payload = /** @type {import('$lib/builder/deploy.js').DeploymentPayload} */ (untyped_payload)

		if (action === 'PUBLISH') {
			for (const file of payload.files) {
				await axios.post('/api/deploy/publish-site', {
					...payload,
					files: [file],
					site_id: payload.site_id,
					message: `Publish site`
				})
			}
			return null
		} else if (action === 'CONNECT_DOMAIN_NAME') {
			const { data } = await axios
				.post('/api/deploy/connect-domain-name', {
					site_id: payload.site_id,
					domain_name: payload.domain_name
				})
				.catch((e) => {
					return { data: { error: e.message, deployment: null } }
				})
			return data
		}
	})

	database_subscribe(async ({ table, action, data, id, match, order }) => {
		console.log({ table, action, data, id, match, order })
		let res
		if (action === 'insert') {
			if (Array.isArray(data)) {
				res = await supabase
					.from(table)
					.insert(data.map((r) => ({ ...r, owner_site: $site.id })))
					.select('id')
			} else {
				res = await supabase
					.from(table)
					.insert({ ...data, owner_site: $site.id })
					.select('id')
					.single()
			}
		} else if (action === 'update') {
			if (id) {
				res = await supabase.from(table).update(data).eq('id', id).select('id').single()
			} else if (match) {
				res = await supabase.from(table).update(data).match(match).select('id').single()
			}
		} else if (action === 'delete') {
			if (id) {
				res = await supabase.from(table).delete().eq('id', id).select()
			} else if (match) {
				res = await supabase.from(table).delete().match(match).select()
			}
		} else if (action === 'upsert') {
			res = await supabase.from(table).upsert(data)
		} else if (action === 'select') {
			if (order) {
				res = await supabase
					.from(table)
					.select(data)
					.match(match)
					.order(...order)
			} else {
				res = await supabase.from(table).select(data).match(match)
			}
		}
		if (res?.error) {
			console.error({
				error: res.error,
				args: { table, action, data, id, match, order }
			})
			return null
		} else if (res?.data && Array.isArray(res.data)) {
			return res.data
		} else if (res?.data) {
			return res.data?.id
		}
	})

	storage_subscribe(async ({ action, key, file, options, type }) => {
		if (action === 'upload') {

			if (type === 'image' && $site.id === 'd0770374-abf9-49c9-b805-e18fe7fe999c') {
				// Fetch the pre-signed URL from your endpoint
				const { data } = await axios.get(`/api/uploads/spoa-get-signed-url?site_id=${$page.data.site.id}&key=${key}&content_type=${file.type}`)

				// Use the pre-signed URL to upload the file
				await axios.put(data.signed, file, {
					headers: {
						'Content-Type': file.type
					}
				})

				return { url: data.url }
			}

			// Fetch the pre-signed URL from your endpoint
			const { data } = await axios.get(`/api/uploads/get-signed-url?site_id=${$page.data.site.id}&key=${key}&content_type=${file.type}`)

			// Use the pre-signed URL to upload the file
			await axios.put(data.signed, file, {
				headers: {
					'Content-Type': file.type
				}
			})

			return { url: data.url }
		}
	})

	const presence_key = data.user.email
	const channel = supabase.channel(data.site.id, {
		config: { presence: { key: presence_key } }
	})

	if (browser) {
		channel.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				channel.track({
					data: {}
				})
			}
		})

		channel
			.on('presence', { event: 'sync' }, () => {
				const state = channel.presenceState()
				$active_users = Object.entries(state)
					.map(([email, value]) => ({ email }))
					.filter((u) => u.email !== data.user.email)

				$locked_blocks = Object.entries(state)
					.flatMap(([key, value]) =>
						value.map(({ data, instance }) => ({
							key,
							block_id: data['active_block'],
							instance: instance
							// user: $user
						}))
					)
					.filter((item) => item.block_id)
			})
			.on('broadcast', { event: 'save' }, (payload) => {
				console.log('broadcast', { payload })
				if (payload.payload.page_id === data.page?.id) {
					invalidate('app:data')
				}
			})
	}

	realtime_subscribe(async (res) => {
		channel.track({
			instance: res.instance,
			user: res.user,
			data: res.data
		})
	})

	broadcast_subscribe(async (res) => {
		channel.send({
			type: 'broadcast',
			event: 'save',
			payload: res
		})
	})

	let subscription_parameter = $state()
	onMount(() => {
		subscription_parameter = $page.url.searchParams.get('subscription')
		goto(window.location.pathname, { replaceState: true }) // remove query params from url
	})

	let primo_symbols = []
</script>

<Primo
	{data}
	on:publish={() => show({ id: 'DEPLOY', options: { max_width: '700px' } })}
	role={data.role}
	{primo_symbols}
	primary_buttons={[
		{
			icon: 'solar:pallete-2-bold',
			label: 'Design',
			onclick: () => show({ id: 'DESIGN', options: { height: '100%' } })
		}
	]}
	secondary_buttons={[
		{
			icon: 'clarity:users-solid',
			label: 'Editors',
			onclick: () => {
				show({
					id: 'COLLABORATION',
					options: { max_width: '500px' }
				})
			}
		}
	]}
>
	{@render children?.()}
</Primo>
