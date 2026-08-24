import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupabaseService } from '../src/supabase/supabase.service';

// Task 13 Ruling 2: the upload controller's FileInterceptor config
// (fileFilter mimetype rejection, 5MB size limit) is wired directly on
// @UseInterceptors and is never exercised by UploadService's unit tests —
// only a real HTTP multipart request through the Nest pipeline reaches it.
describe('Upload (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // PrismaModule is @Global(), so PrismaService is instantiated even
      // though the upload route never touches it. Without overriding it,
      // its real onModuleInit() calls $connect() against DATABASE_URL,
      // which is unset/unreachable in this test environment — override it
      // (unused) purely to keep this app.init() from making a live DB call.
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(SupabaseService)
      .useValue({
        client: {
          storage: {
            from: jest.fn().mockReturnValue({
              upload: jest.fn().mockResolvedValue({ error: null }),
              getPublicUrl: jest.fn().mockReturnValue({
                data: {
                  publicUrl: 'https://example.com/store-images/foo.png',
                },
              }),
            }),
          },
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/upload with a valid PNG returns 200 with the public URL', () => {
    return request(app.getHttpServer())
      .post('/api/upload')
      .attach('image', Buffer.from('fake-png-bytes'), {
        filename: 'photo.png',
        contentType: 'image/png',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.url).toBe('https://example.com/store-images/foo.png');
        expect(res.body.message).toBe('Imagen subida correctamente');
      });
  });

  it("POST /api/upload with a disallowed mimetype returns 400 'Solo se permiten imágenes en formato PNG o JPG'", () => {
    return request(app.getHttpServer())
      .post('/api/upload')
      .attach('image', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe(
          'Solo se permiten imágenes en formato PNG o JPG',
        );
      });
  });

  it('POST /api/upload with a file over the 5MB limit is rejected by multer/platform-express', () => {
    // Found behavior (see task report): @nestjs/platform-express's
    // transformException() maps multer's LIMIT_FILE_SIZE error to a
    // PayloadTooLargeException (413), with multer's own English message
    // ("File too large") rather than a Spanish string — that mapping
    // happens below the controller/service layer, so there is no Spanish
    // string to assert here. This test asserts the real, verified status
    // and error text rather than an assumption.
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
    return request(app.getHttpServer())
      .post('/api/upload')
      .attach('image', oversized, {
        filename: 'big.png',
        contentType: 'image/png',
      })
      .expect(413)
      .expect((res) => {
        expect(res.body.error).toBe('File too large');
      });
  });
});
