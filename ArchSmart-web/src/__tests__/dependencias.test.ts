import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"))

describe("dependencias", () => {
    it.each(["react-icons", "embla-carousel-react", "react-easy-crop", "vaul"])(
        "%s foi removida na Secao 6 e nao volta sem uso",
        (dep) => {
            expect(pkg.dependencies?.[dep]).toBeUndefined()
            expect(pkg.devDependencies?.[dep]).toBeUndefined()
        },
    )

    it("@types/* nao mora em dependencies — tipo nao vai para o bundle", () => {
        const tipos = Object.keys(pkg.dependencies ?? {}).filter((d) => d.startsWith("@types/"))
        expect(tipos, `mova para devDependencies: ${tipos.join(", ")}`).toHaveLength(0)
    })
})
