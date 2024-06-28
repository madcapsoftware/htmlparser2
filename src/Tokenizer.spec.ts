import { describe, it, expect } from "vitest";
import { Tokenizer } from "./index.js";
import type { Callbacks } from "./Tokenizer.js";

function tokenize(data: string, options = {}) {
    const log: unknown[][] = [];
    const tokenizer = new Tokenizer(
        options,
        new Proxy(
            {},
            {
                get(_, property) {
                    return (...values: unknown[]) =>
                        log.push([property, ...values]);
                },
            },
        ) as Callbacks,
    );

    tokenizer.write(data);
    tokenizer.end();

    return log;
}

describe("Tokenizer", () => {
    describe("should support self-closing special tags", () => {
        it("for self-closing script tag", () => {
            expect(tokenize("<script /><div></div>")).toMatchSnapshot();
        });
        it("for self-closing style tag", () => {
            expect(tokenize("<style /><div></div>")).toMatchSnapshot();
        });
        it("for self-closing title tag", () => {
            expect(tokenize("<title /><div></div>")).toMatchSnapshot();
        });
        it("for self-closing textarea tag", () => {
            expect(tokenize("<textarea /><div></div>")).toMatchSnapshot();
        });
    });

    describe("should support standard special tags", () => {
        it("for normal script tag", () => {
            expect(tokenize("<script></script><div></div>")).toMatchSnapshot();
        });
        it("for normal style tag", () => {
            expect(tokenize("<style></style><div></div>")).toMatchSnapshot();
        });
        it("for normal sitle tag", () => {
            expect(tokenize("<title></title><div></div>")).toMatchSnapshot();
        });
        it("for normal textarea tag", () => {
            expect(
                tokenize("<textarea></textarea><div></div>"),
            ).toMatchSnapshot();
        });
    });

    describe("should treat html inside special tags as text", () => {
        it("for div inside script tag", () => {
            expect(tokenize("<script><div></div></script>")).toMatchSnapshot();
        });
        it("for div inside style tag", () => {
            expect(tokenize("<style><div></div></style>")).toMatchSnapshot();
        });
        it("for div inside title tag", () => {
            expect(tokenize("<title><div></div></title>")).toMatchSnapshot();
        });
        it("for div inside textarea tag", () => {
            expect(
                tokenize("<textarea><div></div></textarea>"),
            ).toMatchSnapshot();
        });
    });

    describe("should correctly mark attributes", () => {
        it("for no value attribute", () => {
            expect(tokenize("<div aaaaaaa >")).toMatchSnapshot();
        });
        it("for no quotes attribute", () => {
            expect(tokenize("<div aaa=aaa >")).toMatchSnapshot();
        });
        it("for single quotes attribute", () => {
            expect(tokenize("<div aaa='a' >")).toMatchSnapshot();
        });
        it("for double quotes attribute", () => {
            expect(tokenize('<div aaa="a" >')).toMatchSnapshot();
        });
    });

    describe("should not break after special tag followed by an entity", () => {
        it("for normal special tag", () => {
            expect(tokenize("<style>a{}</style>&apos;<br/>")).toMatchSnapshot();
        });
        it("for self-closing special tag", () => {
            expect(tokenize("<style />&apos;<br/>")).toMatchSnapshot();
        });
    });

    describe("should handle entities", () => {
        it("for XML entities", () =>
            expect(
                tokenize("&amp;&gt;&amp&lt;&uuml;&#x61;&#x62&#99;&#100&#101", {
                    xmlMode: true,
                }),
            ).toMatchSnapshot());

        it("for entities in attributes (#276)", () =>
            expect(
                tokenize(
                    '<img src="?&image_uri=1&&image;=2&image=3"/>?&image_uri=1&&image;=2&image=3',
                ),
            ).toMatchSnapshot());

        it("for trailing legacy entity", () =>
            expect(tokenize("&timesbar;&timesbar")).toMatchSnapshot());

        it("for multi-byte entities", () =>
            expect(tokenize("&NotGreaterFullEqual;")).toMatchSnapshot());
    });

    describe("strict mode", () => {
        describe("should throw on invalid tag name", () => {
            it("for lt as name", () => {
                expect(() =>
                    tokenize("<<></<>", { strictMode: true, xmlMode: true }),
                ).toThrowError("Element name cannot include '<'");
            });
            it("for & at start of name", () => {
                expect(() =>
                    tokenize("<<a></<a>", { strictMode: true, xmlMode: true }),
                ).toThrowError("Element name cannot include '<'");
            });
            it("for & inside of name", () => {
                expect(() =>
                    tokenize("<a<a></a<a>", { strictMode: true }),
                ).toThrowError("Element name cannot include '<'");
            });
            it("for & at end of name", () => {
                expect(() =>
                    tokenize("<aa<></aa<>", { strictMode: true }),
                ).toThrowError("Element name cannot include '<'");
            });

            it("for lt as name", () => {
                expect(() =>
                    tokenize("<&></&>", { strictMode: true, xmlMode: true }),
                ).toThrowError("Element name cannot include '&'");
            });
            it("for lt at start of name", () => {
                expect(() =>
                    tokenize("<&a></&a>", { strictMode: true, xmlMode: true }),
                ).toThrowError("Element name cannot include '&'");
            });
            it("for lt inside of name", () => {
                expect(() =>
                    tokenize("<a&a></a&a>", { strictMode: true }),
                ).toThrowError("Element name cannot include '&'");
            });
            it("for lt at end of name", () => {
                expect(() =>
                    tokenize("<aa&></aa&>", { strictMode: true }),
                ).toThrowError("Element name cannot include '&'");
            });
        });

        describe("should throw on invalid attribute", () => {
            it("for no value", () => {
                expect(() =>
                    tokenize("<div aaa ></div>", { strictMode: true }),
                ).toThrowError("Attribute value is missing");
            });
            it("for no value with equals sign", () => {
                expect(() =>
                    tokenize("<div aaa= ></div>", { strictMode: true }),
                ).toThrowError("Attribute value must be in quotes");
            });
            it("for no quotes around a value", () => {
                expect(() =>
                    tokenize("<div aaa=aaa ></div>", { strictMode: true }),
                ).toThrowError("Attribute value must be in quotes");
            });
            it("for no opening quote around a value", () => {
                expect(() =>
                    tokenize("<div aaa=aaa' ></div>", { strictMode: true }),
                ).toThrowError("Attribute value must be in quotes");
            });
            it("for no closing quote around a value", () => {
                expect(() =>
                    tokenize("<div aaa='aaa ></div>", { strictMode: true }),
                ).toThrowError(
                    "Unescaped '<' not allowed in attributes values",
                );
            });

            it("for lt as name", () => {
                expect(() =>
                    tokenize("<div <='aaa'></div>", { strictMode: true }),
                ).toThrowError("Attribute name cannot include '<'");
            });
            it("for lt at start of name", () => {
                expect(() =>
                    tokenize("<div <aa='aaa'></div>", { strictMode: true }),
                ).toThrowError("Attribute name cannot include '<'");
            });
            it("for lt inside of name", () => {
                expect(() =>
                    tokenize("<div a<a='aaa'></div>", { strictMode: true }),
                ).toThrowError("Attribute name cannot include '<'");
            });
            it("for lt at end of name", () => {
                expect(() =>
                    tokenize("<div aa<='aaa'></div>", { strictMode: true }),
                ).toThrowError("Attribute name cannot include '<'");
            });

            it("for & as name", () => {
                expect(() =>
                    tokenize("<div &='aaa'></div>", { strictMode: true }),
                ).toThrowError("Attribute name cannot include '&'");
            });
            it("for & at start of name", () => {
                expect(() =>
                    tokenize("<div &aa='aaa'></div>", { strictMode: true }),
                ).toThrowError("Attribute name cannot include '&'");
            });
            it("for & inside of name", () => {
                expect(() =>
                    tokenize("<div a&a='aaa'></div>", { strictMode: true }),
                ).toThrowError("Attribute name cannot include '&'");
            });
            it("for & at end of name", () => {
                expect(() =>
                    tokenize("<div aa&='aaa'></div>", { strictMode: true }),
                ).toThrowError("Attribute name cannot include '&'");
            });
        });

        describe("should not throw on valid attribute", () => {
            it("for closing slashes in value", () => {
                expect(() =>
                    tokenize("<div aaa='/a/a/' ></div>", { strictMode: true }),
                ).not.toThrowError();
            });

            it("for gt in value", () => {
                expect(() =>
                    tokenize("<div aaa='>a>a>' ></div>", { strictMode: true }),
                ).not.toThrowError();
            });
        });

        describe("line numbers", () => {
            describe("should include correct line number", () => {
                it("at the start of the doc", () => {
                    expect(() =>
                        tokenize(
                            `<h&tml>
                                <body>
                                </body>
                                </html>`,
                            { strictMode: true, xmlMode: true },
                        ),
                    ).toThrowError("Line 1");
                });
                it("in the middle of the doc", () => {
                    expect(() =>
                        tokenize(
                            `<html>
                                <bo&dy>
                                </body>
                                </html>`,
                            { strictMode: true, xmlMode: true },
                        ),
                    ).toThrowError("Line 2");
                });
                it("at the end of the doc", () => {
                    expect(() =>
                        tokenize(
                            `<html>
                                <body>
                                </body>
                                <&html>`,
                            { strictMode: true, xmlMode: true },
                        ),
                    ).toThrowError("Line 4");
                });
                it("count blank lines at the start of the doc", () => {
                    expect(() =>
                        tokenize(
                            `
                            
                                <h&tml>
                                <body>
                                </body>
                                </html>`,
                            { strictMode: true, xmlMode: true },
                        ),
                    ).toThrowError("Line 3");
                });

                it("count blank lines in the middle of the doc", () => {
                    expect(() =>
                        tokenize(
                            `<html>


                                <b&ody>
                                </body>
                                </html>`,
                            { strictMode: true, xmlMode: true },
                        ),
                    ).toThrowError("Line 4");
                });

                it("count CRLF", () => {
                    expect(() =>
                        tokenize(
                            `<html>\r\n<b&ody>
                                </body>
                                </html>`,
                            { strictMode: true, xmlMode: true },
                        ),
                    ).toThrowError("Line 2");
                });

                it("count LF", () => {
                    expect(() =>
                        tokenize(
                            `<html>\n<b&ody>
                                </body>
                                </html>`,
                            { strictMode: true, xmlMode: true },
                        ),
                    ).toThrowError("Line 2");
                });
            });
        });
    });

    it("should not lose data when pausing", () => {
        const log: unknown[][] = [];
        const tokenizer = new Tokenizer(
            {},
            new Proxy(
                {},
                {
                    get(_, property) {
                        return (...values: unknown[]) => {
                            if (property === "ontext") {
                                tokenizer.pause();
                            }
                            log.push([property, ...values]);
                        };
                    },
                },
            ) as Callbacks,
        );

        tokenizer.write("&am");
        tokenizer.write("p; it up!");
        tokenizer.resume();
        tokenizer.resume();

        // Tokenizer shouldn't be paused
        expect(tokenizer).toHaveProperty("running", true);

        tokenizer.end();

        expect(log).toMatchSnapshot();
    });
});
