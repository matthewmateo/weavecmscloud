<script>
	import _ from 'lodash-es'
	import Icon from '@iconify/svelte'
	import TextInput from '../ui/TextInput.svelte'
	import Spinner from '../ui/Spinner.svelte'
	import site from '../stores/data/site.js'
	import { storageChanged } from '../database.js'
	import imageCompression from 'browser-image-compression'

	const default_value = {
		alt: '',
		url: ''
	}

	let { field, value = $bindable(), children, oninput = /** @type {(val: {value: {url: string, alt: string}, metadata: {size?: number}}) => void} */ () => {} } = $props()

	if (typeof value === 'string' || !value) {
		value = _.cloneDeep(default_value)
	}

	function dispatch_update({ url = value.url, alt = value.alt, size, file_name, file_ext }) {
		oninput({
			value: {
				url,
				alt,
				file_name,
				file_ext
			},
			metadata: {
				size
			}
		})
	}

	async function upload_image(image) {
		loading = true

		// Get compression options from field config or use defaults
		const maxSizeMB = field.options?.maxSizeMB ?? 1
    	const maxWidthOrHeight = field.options?.maxWidthOrHeight ?? 1920

		// Compression options
		const options = {
			maxSizeMB, // Maximum size in MB
			maxWidthOrHeight, // Resize large images to this dimension
			useWebWorker: true // Use web worker for better UI performance
		}

		// Compress the image
		const compressedImage = await imageCompression(image, options)
		console.log(`Original size: ${image.size / 1024 / 1024} MB`)
		console.log(`Compressed size: ${compressedImage.size / 1024 / 1024} MB`)

		await upload(compressedImage)

		async function upload(file) {
			const key = file.name
			const { url, size } = await storageChanged({
				action: 'upload',
				key,
				file,
				type: 'image'
			})

			const file_name = file.name
			const file_ext = file.name.split('.').pop()

			if (url) {
				image_preview = url
				dispatch_update({ 
					url,
					size, 
					file_name,
					file_ext
				})
				image_size = size
			}
			loading = false
		}
	}

	let image_size = $state(null)
	let image_preview = $state(value.url || '')
	let loading = $state(false)

	let width = $state()
	let collapsed = $derived(width < 200)
</script>

<div class="ImageField" bind:clientWidth={width} class:collapsed>
	<span class="primo--field-label">{field.label}</span>
	<div class="image-info">
		<div class="image-preview">
			{#if loading}
				<div class="spinner-container">
					<Spinner />
				</div>
			{:else}
				{#if image_size}
					<span class="field-size">
						{image_size}KB
					</span>
				{/if}
				{#if value.url}
					<img src={image_preview} alt="Preview" />
				{/if}
				<label class="image-upload">
					<Icon icon="uil:image-upload" />
					{#if !value.url}
						<span>Upload</span>
					{/if}
					<input
						onchange={({ target }) => {
							const { files } = target
							if (files.length > 0) {
								const image = files[0]
								upload_image(image)
							}
						}}
						type="file"
						accept="image/*"
					/>
				</label>
			{/if}
		</div>
		<div class="inputs">
			<TextInput value={value.alt} label="Description" oninput={(alt) => dispatch_update({ alt })} />
			<TextInput
				value={value.url}
				label="URL"
				oninput={(value) => {
					image_preview = value
					const file_name = value.split('/').pop()
					const file_ext = value.split('.').pop()

					dispatch_update({ url: value, file_name, file_ext })
				}}
			/>
		</div>
	</div>
</div>
{@render children?.()}

<style lang="postcss">
	* {
		--TextInput-label-font-size: 0.75rem;
	}
	.ImageField {
		display: grid;

		&.collapsed .image-info {
			display: grid;
			gap: 0;
		}

		&.collapsed .inputs {
			padding: 0.5rem;
			background: var(--color-gray-9);
		}
	}
	.image-info {
		display: flex;
		gap: 0.75rem;
		overflow: hidden;
		align-items: flex-start;
		/* border: 1px solid var(--weave-primary-color); */
		/* padding: 0.5rem; */

		.spinner-container {
			background: var(--weave-primary-color);
			height: 100%;
			width: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 3rem;
		}
	}
	input {
		background: var(--color-gray-8);
	}
	.image-preview {
		border: 1px dashed #3e4041;
		border-radius: 4px;
		aspect-ratio: 1;
		height: 100%;
		/* width: 13rem; */
		position: relative;

		.image-upload {
			flex: 1 1 0%;
			padding: 1rem;
			cursor: pointer;
			position: relative;
			width: 100%;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			color: var(--color-gray-2);
			background: var(--color-gray-9);
			font-weight: 600;
			text-align: center;
			position: absolute;
			inset: 0;
			opacity: 0.5;
			transition: opacity, background;
			transition-duration: 0.1s;

			&:hover {
				opacity: 0.95;
				background: var(--weave-primary-color);
			}

			span {
				margin-top: 0.25rem;
			}

			input {
				visibility: hidden;
				border: 0;
				width: 0;
				position: absolute;
			}
		}

		.field-size {
			background: var(--color-gray-8);
			color: var(--color-gray-3);
			position: absolute;
			top: 0;
			left: 0;
			z-index: 1;
			padding: 0.25rem 0.5rem;
			font-size: var(--font-size-1);
			font-weight: 600;
			border-bottom-right-radius: 0.25rem;
		}

		img {
			position: absolute;
			inset: 0;
			object-fit: cover;
			height: 100%;
			width: 100%;
		}
	}

	.inputs {
		display: grid;
		row-gap: 6px;
		width: 100%;
		--TextInput-font-size: 0.75rem;
	}

	/* .image-type-buttons {
		margin-top: 3px;
		font-size: 0.75rem;
		display: flex;
		border-radius: var(--primo-border-radius);
		border: 1px solid var(--color-gray-8);
		justify-self: flex-start;

		button {
			padding: 2px 6px;

			&.active {
				cursor: unset;
				color: var(--weave-primary-color);
			}

			&:last-child {
				border-left: 1px solid var(--color-gray-8);
			}
		}
	} */
</style>
