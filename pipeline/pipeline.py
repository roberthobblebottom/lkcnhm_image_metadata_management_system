from PIL import Image
from PIL.ExifTags import TAGS
from timeit import default_timer as timer
from datetime import timedelta
import polars as pl
from polars import lit, col, when
from os.path import isdir, getsize
from glob import glob
import configparser
import re
from datetime import datetime
# from PIL import ExifTags

# IFD_CODE_LOOKUP = {i.value: i.name for i in ExifTags.IFD}


def recursion(
    path,
    output,
    photographerID,
    # projectID
):
    for file_or_folder_path in glob(path + "/*"):
        if isdir(file_or_folder_path):
            return recursion(
                file_or_folder_path,
                output,
                photographerID,
                # projectID
            )
        if file_or_folder_path.split(".")[-1] not in [
            "tiff",
            "raw",
            "tif",
            "jpg",
            "jpeg",
            "png",
            "tiff",
            "tif",
            "svg",
        ]:
            print("not an valid image extension")
            continue
        if "LABEL" in file_or_folder_path:
            print("label or thumb file, skipping")
            continue
        # This line may be the bottleneck in terms of throughput and speed
        exifData = Image.open(file_or_folder_path).getexif()

        new_row = {}
        # new_row["ProjectName"] = projectID
        new_row["PhotographerID"] = photographerID
        new_row["FilePath"] = file_or_folder_path
        new_row["FileName"] = file_or_folder_path.split("/")[-1]
        new_row["FileFormat"] = "." + file_or_folder_path.split(".")[-1]
        fileNameArray = new_row["FileName"].split(
            " "
        )  # MAY BE CHANGE TO ANOTHER SEPERATOR
        new_row["CatalogID"] = fileNameArray[1]
        if not re.search("^[A-Z]{6}\\d{7,8}$", new_row["CatalogID"]):
            raise Exception(
                "CatalogID in the file "
                + new_row["FileName"]
                + " is not in the correct format. Example of a correct format: ZRCBDP0012345. 6 capital letters and then 7 numbers."
            )
        new_row["MorphoID"] = fileNameArray[0]
        if len(new_row["MorphoID"]) < 5 or new_row["MorphoID"] is int:
            raise Exception(
                "MorphoID in the file "
                + new_row["FileName"]
                + " may not not in the correct format of a taxon name."
            )
        part_with_fileFormat = fileNameArray[-1].split(".")
        new_row["Description"] = part_with_fileFormat[0]

        new_row["FileSizeBytes"] = getsize(file_or_folder_path)

        f = [
            "DateTime",  # TODO Not sure how to write a validation for this.
            "Software",
            "ImageWidth",
            "ImageLength",
            "Make",
            "Model",
            "Description",
        ]
        for tagid in exifData:
            tagname = TAGS.get(tagid, tagid)
            if tagname in f:
                value = exifData.get(tagid)
                if value == "" or value is None:
                    new_row[tagname] = str(value)
                    continue
                value = value.hex().decode() if isinstance(value, bytes) else value
                value = value.split(" ")[0] if tagname == "DateTime" else value
                if tagname in ["ImageWidth", "ImageLength"]:
                    try:
                        int(value)
                    except ValueError:
                        raise Exception(
                            "the file"
                            + new_row["FileName"]
                            + "has a image width or length value that is not integer. please change it to an integer"
                        )
                elif tagname == "DateTime":
                    try:
                        datetime.strptime(value, "%Y:%m:%d")
                    except ValueError:
                        raise Exception(
                            "the file"
                            + new_row["FileName"]
                            + "has a DateTime value that is not in for format of %Y:%m:%d eg: 2005:11:08. please change it."
                        )
                new_row[tagname] = str(value)

            # if type(value) is bytes:
            #     new_row[str(tagname)] = "BINARY NOT CAPTURED"
            # else:
            #     new_row[str(tagname)] = str(value) if value is not None else ""
        for x1 in f:
            if x1 not in list(new_row.keys()):
                new_row[x1] = ""
        new_row = (
            pl.DataFrame(new_row)
            .rename({"Software": "ImagingEditingTool"})
            .rename({"DateTime": "ImagingDate"})
            .select(
                "MorphoID",
                "CatalogID",
                "FileName",
                "FilePath",
                "FileSizeBytes",
                "FileFormat",
                # "ProjectName",
                "PhotographerID",
                "ImagingDate",
                "ImagingEditingTool",
                "ImageWidth",
                "ImageLength",
                "Make",
                "Model",
                "Description",
            )
        )
        print(new_row.transpose(include_header=True))
        output.append(new_row)


def main():
    pl.Config.set_tbl_rows(100)
    pl.Config.set_tbl_cols(100)
    start = timer()
    output = []
    dir = "./*"
    config = configparser.ConfigParser()
    config.read("config.ini")
    try:
        photographerID = int(config["DEFAULT"]["photographerID"])
    except Exception:
        print("Error, photographerID is not an integer. Exiting")
        return

    if photographerID <= 0:
        print("Error: photographerID can only be a positive integer. Exiting... ")
        return

    for f3 in [x for x in glob(dir) if isdir(x)]:
        recursion(
            path=f3,
            output=output,
            photographerID=photographerID,
            # projectID = f3.split("/")[-1]
        )

    stop = timer()
    print("estimated time taken ", timedelta(seconds=stop - start))

    df = (
        pl.concat(output)
        .with_columns(
            Resolution=when((col("ImageLength") != "") | (col("ImageWidth") != ""))
            .then(pl.concat_str(col("ImageLength"), lit("x"), col("ImageWidth")))
            .otherwise(lit("")),
            ImagingDate=col("ImagingDate").str.to_datetime(
                "%Y:%m:%d", ambiguous="null", strict=False
            ),
            imagingPlatform=when((col("Make") != "") | (col("Model") != ""))
            .then(pl.concat_str(col("Make"), lit(" "), col("Model")))
            .otherwise(lit("")),
        )
        .select(pl.exclude("ImageWidth", "ImageLength", "Make", "Model"))
    )
    print(df.head())
    df.write_csv("output.csv")


if __name__ == "__main__":
    main()
