import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import forge from 'node-forge';
import { PDFDocument } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { P12Signer } from '@signpdf/signer-p12';
import { SignPdf } from '@signpdf/signpdf';

export function createLocalInvoiceSigner(dataDir) {
  const files = {
    p12: path.join(dataDir, 'billbloom-signing-key.p12'),
    passphrase: path.join(dataDir, 'billbloom-signing-passphrase.txt'),
    certificate: path.join(dataDir, 'billbloom-signing-certificate.pem'),
  };
  if (!Object.values(files).every((file) => fs.existsSync(file))) {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const certificate = forge.pki.createCertificate();
    certificate.publicKey = keys.publicKey;
    certificate.serialNumber = randomBytes(16).toString('hex').replace(/^0/, '1');
    certificate.validity.notBefore = new Date(Date.now() - 60_000);
    certificate.validity.notAfter = new Date();
    certificate.validity.notAfter.setFullYear(certificate.validity.notAfter.getFullYear() + 5);
    const identity = [
      { name: 'commonName', value: 'BillBloom Local Invoice Signer' },
      { name: 'organizationName', value: 'BillBloom' },
    ];
    certificate.setSubject(identity);
    certificate.setIssuer(identity);
    certificate.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, nonRepudiation: true },
      { name: 'subjectKeyIdentifier' },
    ]);
    certificate.sign(keys.privateKey, forge.md.sha256.create());
    const passphrase = randomBytes(32).toString('base64url');
    const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [certificate], passphrase, {
      algorithm: '3des', friendlyName: 'BillBloom Invoice Signer',
    });
    fs.writeFileSync(files.p12, Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'));
    fs.writeFileSync(files.passphrase, passphrase, { mode: 0o600 });
    fs.writeFileSync(files.certificate, forge.pki.certificateToPem(certificate));
  }

  return {
    certificatePath: files.certificate,
    async sign(pdfBuffer, invoiceNumber = 'BillBloom invoice') {
      if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.subarray(0, 5).toString() !== '%PDF-') {
        throw new Error('The input must be a PDF.');
      }
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const page = pdfDoc.getPages().at(-1);
      if (!page) throw new Error('The PDF has no pages to sign.');
      const { width } = page.getSize();
      const safeNumber = String(invoiceNumber).replace(/[\r\n]/g, '').slice(0, 80);
      pdflibAddPlaceholder({
        pdfDoc,
        pdfPage: page,
        reason: `Digitally signed BillBloom invoice ${safeNumber}`,
        contactInfo: '',
        name: 'BillBloom Local Invoice Signer',
        location: 'Local BillBloom installation',
        signingTime: new Date(),
        signatureLength: 12000,
        appName: 'BillBloom',
        widgetRect: [Math.max(8, width - 220), 20, Math.max(205, width - 20), 54],
      });
      const preparedPdf = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
      const p12 = fs.readFileSync(files.p12);
      const passphrase = fs.readFileSync(files.passphrase, 'utf8');
      return new SignPdf().sign(preparedPdf, new P12Signer(p12, { passphrase }));
    },
  };
}
