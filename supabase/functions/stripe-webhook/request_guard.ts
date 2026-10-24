type SignatureVerifier<Event> = (
  body: string,
  signature: string,
  secret: string,
) => Promise<Event>;

export type SignatureVerificationResult<Event> =
  | { success: true; event: Event }
  | { success: false; reason: 'missing_signature' }
  | { success: false; reason: 'invalid_signature'; error: unknown };

export async function verifyStripeWebhookSignature<Event>(
  request: Pick<Request, 'headers' | 'text'>,
  secret: string,
  verify: SignatureVerifier<Event>,
): Promise<SignatureVerificationResult<Event>> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return { success: false, reason: 'missing_signature' };

  try {
    const event = await verify(await request.text(), signature, secret);
    return { success: true, event };
  } catch (error) {
    return { success: false, reason: 'invalid_signature', error };
  }
}
