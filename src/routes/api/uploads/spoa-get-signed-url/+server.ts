import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import authorize from '../../authorize'
import { PUBLIC_SPOA_BASE_DOMAIN_NAME } from '$env/static/public'
import * as ENV_VARS from '$env/static/private';


const s3_client = new S3Client({
  region: "auto",
  endpoint: `https://${ENV_VARS.PRIVATE_SPOA_CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ENV_VARS.PRIVATE_SPOA_R2_ACCESS_KEY_ID,
    secretAccessKey: ENV_VARS.PRIVATE_SPOA_R2_SECRET_ACCESS_KEY
  }
});

export const GET: RequestHandler = async (event) => {
  return authorize(event, {
    onsuccess: async ({ key, content_type }) => {

      console.log({ key, content_type })

      const command = new PutObjectCommand({
        Bucket: 'media',
        Key: key,
        ContentType: content_type,
      });

      const signed = await getSignedUrl(s3_client, command, { expiresIn: 3600 });
      return json({
        signed,
        url: `https://${PUBLIC_SPOA_BASE_DOMAIN_NAME}/${key}`
      });
    },
    onerror: async () => {
      return json({ error: 'Failed to generate signed URL' }, { status: 500 });
    }
  })
};